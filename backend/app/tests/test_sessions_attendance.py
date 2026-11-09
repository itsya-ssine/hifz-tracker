import pytest

from app.tests.helpers import add_student_direct, login, logout, sql

STUDENTS = "/api/v1/admin/students"
SESSIONS = "/api/v1/admin/sessions"
ATTENDANCE = "/api/v1/admin/attendance"


@pytest.fixture
def admin(client, make_user):
    make_user("boss", role="ADMIN", full_name="The Boss")
    assert login(client, "boss").status_code == 200
    return client


def new_student(client, name, hizb=1, part=1, joined="2026-01-01"):
    response = client.post(STUDENTS, json={
        "login": name, "full_name": name.title(), "start_hizb": hizb, "start_part": part,
        "joined_at": joined, "password": "password123",
    })
    assert response.status_code == 201, response.text
    return response.json()["id"]


def new_session(client, date, **kwargs):
    response = client.post(SESSIONS, json={"session_date": date, **kwargs})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def mark(client, session_id, *entries):
    """entries: (student_id, status[, excuse_note[, admin_note]])"""
    records = []
    for e in entries:
        record = {"student_id": e[0], "status": e[1]}
        if len(e) > 2:
            record["excuse_note"] = e[2]
        if len(e) > 3:
            record["admin_note"] = e[3]
        records.append(record)
    return client.put(f"{SESSIONS}/{session_id}/attendance", json={"records": records})


def student(client, student_id):
    return client.get(f"{STUDENTS}/{student_id}").json()["student"]


def history(client, student_id):
    """Records oldest first as (date, status, part_index)."""
    items = client.get(f"{STUDENTS}/{student_id}/history?page_size=100").json()["items"]
    return [(r["session_date"], r["status"], r["part_index"]) for r in reversed(items)]


# --- sessions -----------------------------------------------------------------------


def test_session_crud_and_rules(admin):
    sid = new_session(admin, "2026-02-05", title="  Week 1 ", notes="Bring your mushaf")
    body = admin.get(f"{SESSIONS}/{sid}").json()["session"]
    assert body["title"] == "Week 1" and body["is_cancelled"] is False
    assert body["counts"] == {"marked": 0, "passed": 0, "not_passed": 0, "absent": 0, "absent_excused": 0}

    dup = admin.post(SESSIONS, json={"session_date": "2026-02-05"})
    assert dup.status_code == 409 and dup.json()["code"] == "SESSION_DATE_TAKEN"
    assert admin.post(SESSIONS, json={"session_date": "not-a-date"}).status_code == 422

    other = new_session(admin, "2026-02-12")
    listing = admin.get(SESSIONS).json()
    assert [s["session_date"] for s in listing["items"]] == ["2026-02-12", "2026-02-05"]  # newest first

    assert admin.patch(f"{SESSIONS}/{sid}", json={"notes": None}).json()["notes"] is None
    assert admin.patch(f"{SESSIONS}/{sid}", json={"session_date": "2026-02-12"}).json()["code"] == "SESSION_DATE_TAKEN"
    assert admin.patch(f"{SESSIONS}/{sid}", json={"session_date": "2026-02-06"}).json()["session_date"] == "2026-02-06"
    assert admin.patch(f"{SESSIONS}/{other}", json={"is_cancelled": True}).json()["is_cancelled"] is True
    assert admin.delete(f"{SESSIONS}/{other}").status_code == 204
    assert admin.get(f"{SESSIONS}/{other}").json()["code"] == "SESSION_NOT_FOUND"


def test_sessions_with_records_cannot_be_moved_cancelled_or_deleted(admin):
    s = new_student(admin, "sara")
    sid = new_session(admin, "2026-02-05")
    mark(admin, sid, (s, "PASSED"))
    for response in (
        admin.patch(f"{SESSIONS}/{sid}", json={"session_date": "2026-02-06"}),
        admin.patch(f"{SESSIONS}/{sid}", json={"is_cancelled": True}),
        admin.delete(f"{SESSIONS}/{sid}"),
    ):
        assert response.status_code == 409 and response.json()["code"] == "SESSION_HAS_RECORDS"
    assert admin.patch(f"{SESSIONS}/{sid}", json={"title": "Renamed"}).json()["title"] == "Renamed"


# --- the sheet ---------------------------------------------------------------------------


def test_sheet_lists_eligible_students_with_the_part_to_evaluate(admin, db_url):
    amine = new_student(admin, "amine", hizb=3, part=2)
    new_student(admin, "latecomer", joined="2026-03-01")
    paused = new_student(admin, "paused")
    admin.patch(f"{STUDENTS}/{paused}", json={"status": "PAUSED"})
    sid = new_session(admin, "2026-02-05")

    sheet = admin.get(f"{SESSIONS}/{sid}").json()
    assert [s["login"] for s in sheet["students"]] == ["amine"]  # not joined yet / paused are excluded
    row = sheet["students"][0]
    assert (row["student_id"], row["hizb"], row["part"], row["part_index"]) == (amine, 3, 2, 18)
    assert row["record"] is None and sheet["unmarked"] == 1


def test_sheet_for_a_past_session_shows_the_part_at_that_time(admin):
    s = new_student(admin, "sara")
    s1, s2, s3 = (new_session(admin, d) for d in ("2026-02-05", "2026-02-12", "2026-02-19"))
    mark(admin, s1, (s, "PASSED"))
    mark(admin, s2, (s, "PASSED"))
    # s3 is unmarked: sara has two passes before it, so she is on part 3.
    row = admin.get(f"{SESSIONS}/{s3}").json()["students"][0]
    assert row["part_index"] == 3 and row["record"] is None
    # And the already-marked past session still shows the part evaluated then.
    assert admin.get(f"{SESSIONS}/{s2}").json()["students"][0]["part_index"] == 2


def test_marked_students_stay_on_the_sheet_even_if_paused_later(admin):
    s = new_student(admin, "sara")
    sid = new_session(admin, "2026-02-05")
    mark(admin, sid, (s, "PASSED"))
    admin.patch(f"{STUDENTS}/{s}", json={"status": "PAUSED"})
    assert [r["login"] for r in admin.get(f"{SESSIONS}/{sid}").json()["students"]] == ["sara"]


# --- marking attendance ----------------------------------------------------------------------


def test_only_passed_advances_and_part_indexes_follow(admin):
    s = new_student(admin, "sara", hizb=1, part=7)
    dates = ["2026-02-05", "2026-02-12", "2026-02-19", "2026-02-26", "2026-03-05"]
    outcomes = ["PASSED", "NOT_PASSED", "ABSENT", "ABSENT_EXCUSED", "PASSED"]
    for date, status in zip(dates, outcomes):
        result = mark(admin, new_session(admin, date), (s, status))
        assert result.status_code == 200, result.text

    # start (1,7)=7; passes in week 1 and 5 -> 9 = (2,1)
    assert student(admin, s)["current_index"] == 9
    assert student(admin, s)["position"] == {"hizb": 2, "part": 1}
    assert history(admin, s) == [
        ("2026-02-05", "PASSED", 7), ("2026-02-12", "NOT_PASSED", 8), ("2026-02-19", "ABSENT", 8),
        ("2026-02-26", "ABSENT_EXCUSED", 8), ("2026-03-05", "PASSED", 8),
    ]


def test_bulk_save_returns_counts_and_the_updated_sheet(admin):
    a, b, c = (new_student(admin, n) for n in ("amine", "bilal", "chaima"))
    sid = new_session(admin, "2026-02-05")
    result = mark(admin, sid, (a, "PASSED"), (b, "ABSENT_EXCUSED", "Exam", "Call back"))
    assert result.status_code == 200
    body = result.json()
    assert (body["created"], body["updated"], body["unchanged"]) == (2, 0, 0)
    assert body["detail"]["unmarked"] == 1
    assert body["detail"]["session"]["counts"]["marked"] == 2
    bilal = next(s for s in body["detail"]["students"] if s["login"] == "bilal")
    assert bilal["record"]["excuse_note"] == "Exam" and bilal["record"]["admin_note"] == "Call back"


def test_saving_the_same_sheet_twice_is_idempotent(admin, db_url):
    a, b = new_student(admin, "amine"), new_student(admin, "bilal")
    sid = new_session(admin, "2026-02-05")
    mark(admin, sid, (a, "PASSED"), (b, "NOT_PASSED"))
    audit_before = sql(db_url, "SELECT COUNT(*) AS n FROM audit_log")[0]["n"]

    again = mark(admin, sid, (a, "PASSED"), (b, "NOT_PASSED")).json()
    assert (again["created"], again["updated"], again["unchanged"]) == (0, 0, 2)
    assert sql(db_url, "SELECT COUNT(*) AS n FROM audit_log")[0]["n"] == audit_before
    assert student(admin, a)["current_index"] == 2  # not advanced twice


def test_changing_status_updates_the_record_and_clears_excuse_notes(admin):
    s = new_student(admin, "sara")
    sid = new_session(admin, "2026-02-05")
    mark(admin, sid, (s, "ABSENT_EXCUSED", "Sick"))
    result = mark(admin, sid, (s, "ABSENT", "should be ignored")).json()
    assert result["updated"] == 1
    record = result["detail"]["students"][0]["record"]
    assert record["status"] == "ABSENT" and record["excuse_note"] is None


def test_hizb_rollover_and_completion(admin):
    edge = new_student(admin, "edge", hizb=1, part=8)
    last = new_student(admin, "last", hizb=60, part=8)
    s1, s2 = new_session(admin, "2026-02-05"), new_session(admin, "2026-02-12")
    mark(admin, s1, (edge, "PASSED"), (last, "PASSED"))

    assert student(admin, edge)["position"] == {"hizb": 2, "part": 1}
    done = student(admin, last)
    assert done["status"] == "COMPLETED" and done["position"] is None and done["current_index"] == 481

    # Completed students no longer appear on later sheets, but stay on the one they completed.
    assert [r["login"] for r in admin.get(f"{SESSIONS}/{s2}").json()["students"]] == ["edge"]
    assert {r["login"] for r in admin.get(f"{SESSIONS}/{s1}").json()["students"]} == {"edge", "last"}
    refused = mark(admin, s2, (last, "PASSED"))
    assert refused.status_code == 400 and refused.json()["code"] == "STUDENT_NOT_ELIGIBLE"


# --- corrections ---------------------------------------------------------------------------------


def test_correcting_an_old_record_ripples_through_later_ones_and_is_audited(admin):
    s = new_student(admin, "sara", hizb=1, part=1)
    sessions = [new_session(admin, d) for d in ("2026-02-05", "2026-02-12", "2026-02-19")]
    for sid in sessions:
        mark(admin, sid, (s, "PASSED"))
    assert [h[2] for h in history(admin, s)] == [1, 2, 3] and student(admin, s)["current_index"] == 4

    first = admin.get(f"{SESSIONS}/{sessions[0]}").json()["students"][0]["record"]["id"]
    fixed = admin.patch(f"{ATTENDANCE}/{first}", json={"status": "NOT_PASSED", "admin_note": "Mistake"})
    assert fixed.status_code == 200 and fixed.json()["status"] == "NOT_PASSED"

    assert history(admin, s) == [
        ("2026-02-05", "NOT_PASSED", 1), ("2026-02-12", "PASSED", 1), ("2026-02-19", "PASSED", 2),
    ]
    assert student(admin, s)["current_index"] == 3

    entry = admin.get(f"{STUDENTS}/{s}/audit").json()["items"][0]
    assert entry["action"] == "ATTENDANCE_UPDATED" and entry["entity_id"] == first
    assert entry["old_value"]["status"] == "PASSED" and entry["new_value"]["status"] == "NOT_PASSED"
    assert entry["new_value"]["session_date"] == "2026-02-05" and entry["actor_name"] == "The Boss"


def test_a_correction_can_reopen_a_completed_student(admin):
    s = new_student(admin, "last", hizb=60, part=8)
    sid = new_session(admin, "2026-02-05")
    mark(admin, sid, (s, "PASSED"))
    assert student(admin, s)["status"] == "COMPLETED"
    record = admin.get(f"{SESSIONS}/{sid}").json()["students"][0]["record"]["id"]
    admin.patch(f"{ATTENDANCE}/{record}", json={"status": "NOT_PASSED"})
    reopened = student(admin, s)
    assert reopened["status"] == "ACTIVE" and reopened["position"] == {"hizb": 60, "part": 8}


def test_deleting_a_record_recomputes_progress_and_is_audited(admin):
    s = new_student(admin, "sara")
    s1, s2 = new_session(admin, "2026-02-05"), new_session(admin, "2026-02-12")
    mark(admin, s1, (s, "PASSED"))
    mark(admin, s2, (s, "PASSED"))
    record = admin.get(f"{SESSIONS}/{s1}").json()["students"][0]["record"]["id"]

    assert admin.delete(f"{ATTENDANCE}/{record}").status_code == 204
    assert history(admin, s) == [("2026-02-12", "PASSED", 1)]
    assert student(admin, s)["current_index"] == 2
    assert admin.get(f"{STUDENTS}/{s}/audit").json()["items"][0]["action"] == "ATTENDANCE_DELETED"
    assert admin.delete(f"{ATTENDANCE}/{record}").json()["code"] == "RECORD_NOT_FOUND"
    assert admin.patch(f"{ATTENDANCE}/9999", json={"status": "PASSED"}).status_code == 404


def test_patch_record_can_edit_notes_only(admin):
    s = new_student(admin, "sara")
    sid = new_session(admin, "2026-02-05")
    mark(admin, sid, (s, "ABSENT_EXCUSED", "Sick"))
    record = admin.get(f"{SESSIONS}/{sid}").json()["students"][0]["record"]["id"]
    body = admin.patch(f"{ATTENDANCE}/{record}", json={"excuse_note": "Flu", "admin_note": "Get well"}).json()
    assert (body["status"], body["excuse_note"], body["admin_note"]) == ("ABSENT_EXCUSED", "Flu", "Get well")


# --- validation & safety ---------------------------------------------------------------------------


def test_invalid_sheets_are_rejected_without_writing_anything(admin, db_url):
    s = new_student(admin, "sara")
    new_student(admin, "latecomer", joined="2026-12-01")
    sid = new_session(admin, "2026-02-05")
    unknown = admin.get(STUDENTS).json()["items"]
    latecomer = next(i["id"] for i in unknown if i["login"] == "latecomer")

    refused = mark(admin, sid, (s, "PASSED"), (latecomer, "PASSED"))
    assert refused.status_code == 400 and refused.json()["code"] == "STUDENT_NOT_ELIGIBLE"
    assert sql(db_url, "SELECT COUNT(*) AS n FROM attendance_records")[0]["n"] == 0  # all-or-nothing
    assert student(admin, s)["current_index"] == 1

    assert mark(admin, sid, (s, "PASSED"), (s, "ABSENT")).status_code == 422  # duplicate student
    assert admin.put(f"{SESSIONS}/{sid}/attendance", json={"records": []}).status_code == 422
    assert admin.put(f"{SESSIONS}/{sid}/attendance",
                     json={"records": [{"student_id": s, "status": "MAYBE"}]}).status_code == 422
    assert mark(admin, 9999, (s, "PASSED")).json()["code"] == "SESSION_NOT_FOUND"


def test_cancelled_sessions_reject_attendance(admin):
    s = new_student(admin, "sara")
    sid = new_session(admin, "2026-02-05")
    admin.patch(f"{SESSIONS}/{sid}", json={"is_cancelled": True})
    refused = mark(admin, sid, (s, "PASSED"))
    assert refused.status_code == 400 and refused.json()["code"] == "SESSION_CANCELLED"


def test_a_student_sees_what_the_admin_recorded(admin, client):
    s = new_student(admin, "sara")
    sid = new_session(admin, "2026-02-05", title="Week 1")
    mark(admin, sid, (s, "PASSED", None, "Excellent tajweed"))
    logout(admin)

    assert login(client, "sara").status_code == 200
    # Admin-created accounts must change their password before using the app.
    assert client.get("/api/v1/me/overview").json()["code"] == "PASSWORD_CHANGE_REQUIRED"
    changed = client.post("/api/v1/auth/change-password",
                          json={"current_password": "password123", "new_password": "a-new-password-1"})
    assert changed.status_code == 200

    overview = client.get("/api/v1/me/overview").json()
    assert overview["position"] == {"hizb": 1, "part": 2} and overview["stats"]["passed"] == 1
    record = client.get("/api/v1/me/history").json()["items"][0]
    assert record["title"] == "Week 1" and record["admin_note"] == "Excellent tajweed"


def test_attendance_endpoints_are_admin_only(client, make_user, db_url):
    sid_student = add_student_direct(db_url, "alice")
    login(client, "alice")
    for method, url, body in [
        ("get", SESSIONS, None), ("post", SESSIONS, {"session_date": "2026-02-05"}),
        ("get", f"{SESSIONS}/1", None), ("put", f"{SESSIONS}/1/attendance",
                                          {"records": [{"student_id": sid_student, "status": "PASSED"}]}),
        ("patch", f"{ATTENDANCE}/1", {"status": "PASSED"}), ("delete", f"{ATTENDANCE}/1", None),
    ]:
        response = getattr(client, method)(url, **({"json": body} if body else {}))
        assert response.status_code == 403, (method, url)
