import pytest

from app.tests.helpers import add_session_direct, add_student_direct, login, logout, sql

API = "/api/v1/admin/students"


@pytest.fixture
def admin(client, make_user):
    make_user("boss", role="ADMIN", full_name="The Boss")
    assert login(client, "boss").status_code == 200
    return client


def create(client, login_name="sara", **overrides):
    payload = {"login": login_name, "full_name": "Sara Ait", **overrides}
    return client.post(API, json=payload)


# --- creation -------------------------------------------------------------------


def test_create_student_generates_a_temporary_password_and_forces_change(admin, db_url):
    response = create(admin, "sara", email="Sara@Example.com", start_hizb=3, start_part=2)
    assert response.status_code == 201
    body = response.json()
    assert body["login"] == "sara" and body["email"] == "sara@example.com"
    assert body["start_index"] == 18 and body["position"] == {"hizb": 3, "part": 2}
    assert body["status"] == "ACTIVE" and body["temporary_password"]
    assert len(body["temporary_password"]) >= 8

    logout(admin)
    signed_in = login(admin, "sara", body["temporary_password"])
    assert signed_in.status_code == 200 and signed_in.json()["must_change_password"] is True


def test_create_student_with_chosen_password_and_join_date(admin):
    body = create(admin, "omar", password="chosen-pass-1", joined_at="2025-09-01").json()
    assert body["temporary_password"] is None and body["joined_at"] == "2025-09-01"
    logout(admin)
    assert login(admin, "omar", "chosen-pass-1").status_code == 200


def test_create_student_validation_and_conflicts(admin):
    assert create(admin, "sara").status_code == 201
    assert create(admin, "SARA").json()["code"] == "LOGIN_TAKEN"
    assert create(admin, "other", email="sara@x.com").status_code == 201
    assert create(admin, "third", email="sara@x.com").json()["code"] == "EMAIL_TAKEN"
    assert create(admin, "ab").status_code == 422  # login too short
    assert create(admin, "has space").status_code == 422
    assert create(admin, "okay1", email="not-an-email").status_code == 422
    assert create(admin, "okay2", start_hizb=61).status_code == 422
    assert create(admin, "okay3", start_part=0).status_code == 422
    assert create(admin, "okay4", password="short").status_code == 422


def test_creation_is_audited(admin):
    student_id = create(admin, "sara").json()["id"]
    entries = admin.get(f"{API}/{student_id}/audit").json()
    assert entries["total"] == 1
    assert entries["items"][0]["action"] == "STUDENT_CREATED"
    assert entries["items"][0]["actor_name"] == "The Boss"
    assert entries["items"][0]["student_id"] == student_id


# --- listing --------------------------------------------------------------------


def seed_students(db_url):
    ids = {}
    for name, start, full in [
        ("amine", 1, "Amine Zahiri"), ("bilal", 9, "Bilal Alami"),
        ("chaima", 9, "Chaima Benjelloun"), ("driss", 100, "Driss 50%_Test"),
    ]:
        ids[name] = add_student_direct(db_url, name, start_index=start, full_name=full)
    s1 = add_session_direct(db_url, "2026-02-01")
    s2 = add_session_direct(db_url, "2026-02-08")
    for student, statuses in [("amine", ["PASSED", "PASSED"]), ("bilal", ["PASSED", "ABSENT"]),
                              ("chaima", ["NOT_PASSED", "ABSENT_EXCUSED"])]:
        for session, status in zip([s1, s2], statuses):
            sql(db_url, "INSERT INTO attendance_records (session_id, student_id, status, part_index)"
                        " VALUES (?, ?, ?, 1)", [session, ids[student], status])
    sql(db_url, "UPDATE students SET current_index = start_index + (SELECT COUNT(*) FROM attendance_records"
                " WHERE student_id = students.id AND status = 'PASSED')")
    sql(db_url, "UPDATE students SET status = 'PAUSED' WHERE id = ?", [ids["driss"]])
    return ids


def names(response):
    return [i["login"] for i in response.json()["items"]]


def test_list_search_filter_sort_and_pagination(admin, db_url):
    seed_students(db_url)

    everyone = admin.get(API)
    assert everyone.json()["total"] == 4
    assert names(everyone) == ["amine", "bilal", "chaima", "driss"]  # default: by name
    assert names(admin.get(f"{API}?sort=name")) == ["amine", "bilal", "chaima", "driss"]
    assert names(admin.get(f"{API}?sort=name&order=desc")) == ["driss", "chaima", "bilal", "amine"]

    assert names(admin.get(f"{API}?search=ALAMI")) == ["bilal"]
    assert names(admin.get(f"{API}?search=chaima")) == ["chaima"]
    assert names(admin.get(f"{API}?search=50%25")) == ["driss"]  # '%' is escaped, not a wildcard
    assert names(admin.get(f"{API}?search=%25")) == ["driss"]
    assert names(admin.get(f"{API}?status=PAUSED")) == ["driss"]
    assert names(admin.get(f"{API}?hizb=2&sort=login")) == ["bilal", "chaima"]

    by_position = admin.get(f"{API}?sort=position&order=desc").json()["items"]
    assert [i["login"] for i in by_position] == ["driss", "bilal", "chaima", "amine"]

    by_attendance = admin.get(f"{API}?sort=attendance&order=desc")
    assert names(by_attendance) == ["amine", "bilal", "chaima", "driss"]  # driss (no records) last
    assert names(admin.get(f"{API}?sort=attendance&order=asc"))[-1] == "driss"

    page = admin.get(f"{API}?page_size=2&page=2").json()
    assert page["total"] == 4 and [i["login"] for i in page["items"]] == ["chaima", "driss"]
    assert admin.get(f"{API}?sort=bogus").status_code == 422


def test_list_items_carry_progress_and_attendance(admin, db_url):
    seed_students(db_url)
    items = {i["login"]: i for i in admin.get(API).json()["items"]}
    amine = items["amine"]
    assert amine["current_index"] == 3 and amine["position"] == {"hizb": 1, "part": 3}
    assert amine["total_sessions"] == 2 and amine["passed"] == 2 and amine["attendance_rate"] == 1.0
    assert amine["last_status"] == "PASSED"
    assert items["bilal"]["attendance_rate"] == 0.5 and items["bilal"]["last_status"] == "ABSENT"
    assert items["driss"]["attendance_rate"] is None and items["driss"]["last_status"] is None


def test_hizb_filter_matches_the_current_hizb(admin, db_url):
    seed_students(db_url)
    # bilal: index 10 and chaima: index 9 -> hizb 2; amine index 3 -> hizb 1; driss index 100 -> hizb 13
    assert sorted(names(admin.get(f"{API}?hizb=2"))) == ["bilal", "chaima"]
    assert names(admin.get(f"{API}?hizb=1")) == ["amine"]
    assert names(admin.get(f"{API}?hizb=13")) == ["driss"]


# --- detail ---------------------------------------------------------------------


def test_detail_history_and_timeline(admin, db_url):
    ids = seed_students(db_url)
    detail = admin.get(f"{API}/{ids['bilal']}").json()
    assert detail["student"]["login"] == "bilal"
    assert detail["overview"]["stats"]["absent"] == 1
    assert detail["progress"]["completed_parts"] == detail["overview"]["progress"]["completed_parts"]

    history = admin.get(f"{API}/{ids['bilal']}/history").json()
    assert history["total"] == 2 and history["items"][0]["session_date"] == "2026-02-08"
    assert admin.get(f"{API}/{ids['bilal']}/progress-timeline").json()["start_index"] == 9
    assert admin.get(f"{API}/9999").json()["code"] == "STUDENT_NOT_FOUND"
    assert admin.get(f"{API}/9999/history").status_code == 404


# --- updates --------------------------------------------------------------------


def test_update_profile_status_and_audit(admin, db_url):
    student_id = create(admin, "sara").json()["id"]
    response = admin.patch(
        f"{API}/{student_id}",
        json={"full_name": "Sara A.", "status": "PAUSED", "notes": "  travelling ", "preferred_lang": "ar"},
    )
    body = response.json()
    assert response.status_code == 200
    assert (body["full_name"], body["status"], body["notes"], body["preferred_lang"]) == (
        "Sara A.", "PAUSED", "travelling", "ar")

    audit = admin.get(f"{API}/{student_id}/audit").json()["items"]
    assert audit[0]["action"] == "STUDENT_UPDATED"
    assert audit[0]["old_value"]["status"] == "ACTIVE" and audit[0]["new_value"]["status"] == "PAUSED"

    # A no-op update writes no audit entry.
    admin.patch(f"{API}/{student_id}", json={"status": "PAUSED"})
    assert admin.get(f"{API}/{student_id}/audit").json()["total"] == 2


def test_update_email_conflict_and_clearing(admin):
    first = create(admin, "one", email="one@x.com").json()["id"]
    second = create(admin, "two", email="two@x.com").json()["id"]
    assert admin.patch(f"{API}/{second}", json={"email": "one@x.com"}).json()["code"] == "EMAIL_TAKEN"
    assert admin.patch(f"{API}/{first}", json={"email": None}).json()["email"] is None


def test_deactivating_an_account_blocks_login(admin):
    student = create(admin, "sara", password="password123").json()
    assert admin.patch(f"{API}/{student['id']}", json={"is_active": False}).json()["is_active"] is False
    logout(admin)
    assert login(admin, "sara").status_code == 401


def test_manual_position_correction(admin, db_url):
    student_id = create(admin, "sara", start_hizb=1, start_part=1).json()["id"]
    sess = [add_session_direct(db_url, f"2026-03-0{i}") for i in (1, 2)]
    for s in sess:
        sql(db_url, "INSERT INTO attendance_records (session_id, student_id, status, part_index)"
                    " VALUES (?, ?, 'PASSED', 1)", [s, student_id])
    sql(db_url, "UPDATE students SET current_index = 3 WHERE id = ?", [student_id])

    body = admin.patch(f"{API}/{student_id}", json={"position": {"hizb": 5, "part": 4}}).json()
    assert body["current_index"] == 36 and body["position"] == {"hizb": 5, "part": 4}
    assert body["start_index"] == 34  # 36 minus the 2 recorded passes
    parts = [r["part_index"] for r in sql(db_url, "SELECT part_index FROM attendance_records"
                                                   " WHERE student_id = ? ORDER BY id", [student_id])]
    assert parts == [34, 35]

    # Moving behind the recorded passes is refused: fix the records instead.
    refused = admin.patch(f"{API}/{student_id}", json={"position": {"hizb": 1, "part": 1}})
    assert refused.status_code == 400 and refused.json()["code"] == "INVALID_POSITION"
    assert admin.patch(f"{API}/{student_id}", json={"position": {"hizb": 61, "part": 1}}).status_code == 422


def test_cannot_change_status_of_a_completed_student(admin, db_url):
    student_id = create(admin, "sara", start_hizb=60, start_part=8).json()["id"]
    session = add_session_direct(db_url, "2026-03-01")
    sql(db_url, "INSERT INTO attendance_records (session_id, student_id, status, part_index)"
                " VALUES (?, ?, 'PASSED', 480)", [session, student_id])
    sql(db_url, "UPDATE students SET current_index = 481, status = 'COMPLETED' WHERE id = ?", [student_id])
    refused = admin.patch(f"{API}/{student_id}", json={"status": "PAUSED"})
    assert refused.status_code == 400 and refused.json()["code"] == "STUDENT_COMPLETED"


def test_reset_password(admin):
    student = create(admin, "sara", password="old-password-1").json()
    temp = admin.post(f"{API}/{student['id']}/reset-password").json()["temporary_password"]
    logout(admin)
    assert login(admin, "sara", "old-password-1").status_code == 401
    assert login(admin, "sara", temp).json()["must_change_password"] is True


# --- permissions ------------------------------------------------------------------


def test_admin_endpoints_are_admin_only(client, make_user, db_url):
    student_id = add_student_direct(db_url, "alice")
    assert client.get(API).status_code == 401
    login(client, "alice")
    for method, url in [("get", API), ("get", f"{API}/{student_id}"), ("post", API),
                        ("patch", f"{API}/{student_id}"), ("post", f"{API}/{student_id}/reset-password"),
                        ("get", f"{API}/{student_id}/audit")]:
        response = getattr(client, method)(url, **({"json": {}} if method in ("post", "patch") else {}))
        assert response.status_code == 403, (method, url)
