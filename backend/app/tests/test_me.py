from app.services import progress as p
from app.tests.helpers import add_session_direct, add_student_direct, login, logout, sql


def _record(db_url, session_id, student_id, status, **notes):
    sql(
        db_url,
        "INSERT INTO attendance_records (session_id, student_id, status, part_index, excuse_note, admin_note)"
        " VALUES (?, ?, ?, 1, ?, ?)",
        [session_id, student_id, status, notes.get("excuse"), notes.get("note")],
    )


def _recompute(db_url, student_id):
    import asyncio

    from app.core.db import Database

    async def run():
        database = Database.connect(db_url)
        try:
            await database.batch(p.recompute_student_statements(student_id))
        finally:
            await database.close()

    asyncio.run(run())


def seed_history(db_url, login_name="alice", start_index=9):
    student = add_student_direct(db_url, login_name, start_index=start_index)
    statuses = ["PASSED", "PASSED", "NOT_PASSED", "ABSENT_EXCUSED", "PASSED", "PASSED"]
    for i, status in enumerate(statuses):
        session = add_session_direct(db_url, f"2026-02-{i + 1:02d}", title=f"Week {i + 1}")
        _record(db_url, session, student, status, excuse="Sick" if status == "ABSENT_EXCUSED" else None)
    _recompute(db_url, student)
    return student


def test_overview_for_a_student(client, db_url):
    seed_history(db_url)
    login(client, "alice")
    body = client.get("/api/v1/me/overview").json()

    # start (2, 1) + 4 passes -> index 13 = hizb 2, part 5
    assert body["student"]["current_index"] == 13
    assert body["position"] == {"hizb": 2, "part": 5}
    assert body["completed"] is False
    assert body["progress"] == {
        "completed_parts": 12, "total_parts": 480, "percent": 2.5, "parts_gained": 4,
    }
    stats = body["stats"]
    assert (stats["total_sessions"], stats["passed"], stats["not_passed"]) == (6, 4, 1)
    assert stats["absent"] == 0 and stats["absent_excused"] == 1
    assert stats["attendance_rate"] == round(5 / 6, 4)
    assert stats["adjusted_attendance_rate"] == 1.0
    assert stats["current_streak"] == 2
    assert body["last_record"]["session_date"] == "2026-02-06"
    assert body["last_record"]["status"] == "PASSED"


def test_overview_of_a_student_without_records(client, db_url):
    add_student_direct(db_url, "newbie")
    login(client, "newbie")
    body = client.get("/api/v1/me/overview").json()
    assert body["position"] == {"hizb": 1, "part": 1}
    assert body["stats"]["attendance_rate"] is None and body["stats"]["current_streak"] == 0
    assert body["last_record"] is None and body["next_session"] is None


def test_completed_student_has_no_position(client, db_url):
    student = add_student_direct(db_url, "done", start_index=p.TOTAL_PARTS)
    _record(db_url, add_session_direct(db_url, "2026-02-01"), student, "PASSED")
    _recompute(db_url, student)
    login(client, "done")
    body = client.get("/api/v1/me/overview").json()
    assert body["completed"] is True and body["position"] is None
    assert body["progress"]["percent"] == 100.0 and body["student"]["status"] == "COMPLETED"


def test_history_is_paginated_filtered_and_newest_first(client, db_url):
    seed_history(db_url)
    login(client, "alice")

    page1 = client.get("/api/v1/me/history?page_size=4").json()
    assert page1["total"] == 6 and len(page1["items"]) == 4
    assert [r["session_date"] for r in page1["items"]][:2] == ["2026-02-06", "2026-02-05"]
    page2 = client.get("/api/v1/me/history?page_size=4&page=2").json()
    assert len(page2["items"]) == 2

    excused = client.get("/api/v1/me/history?status=ABSENT_EXCUSED").json()
    assert excused["total"] == 1 and excused["items"][0]["excuse_note"] == "Sick"
    first = client.get("/api/v1/me/history?page_size=100").json()["items"][-1]
    assert (first["hizb"], first["part"], first["part_index"]) == (2, 1, 9)
    assert client.get("/api/v1/me/history?status=BOGUS").status_code == 422


def test_timeline_starts_at_the_start_position(client, db_url):
    seed_history(db_url)
    login(client, "alice")
    body = client.get("/api/v1/me/progress-timeline").json()
    assert body["start_index"] == 9
    assert [pt["current_index"] for pt in body["points"]] == [9, 10, 11, 11, 11, 12, 13]
    assert body["points"][0]["status"] is None


def test_students_only_see_their_own_data(client, db_url):
    seed_history(db_url, "alice")
    add_student_direct(db_url, "bob")
    login(client, "bob")
    assert client.get("/api/v1/me/history").json()["total"] == 0


def test_me_endpoints_require_a_student(client, make_user):
    assert client.get("/api/v1/me/overview").status_code == 401
    make_user("boss", role="ADMIN")
    login(client, "boss")
    assert client.get("/api/v1/me/overview").status_code == 403
    logout(client)
