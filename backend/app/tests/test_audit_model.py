from app.core.db import Database
from app.models import audit


async def test_audit_entries_are_stored_and_listed_newest_first(db: Database):
    await db.batch(
        [
            audit.insert_statement(actor_id=None, action="A", entity="student", entity_id=1,
                                   student_id=1, old={"x": 1}, new={"x": 2}),
            audit.insert_statement(actor_id=None, action="B", entity="student", entity_id=2,
                                   student_id=2, new={"name": "يوسف"}),
        ]
    )
    items, total = await audit.list_entries(db)
    assert total == 2 and [i["action"] for i in items] == ["B", "A"]
    assert items[0]["new_value"] == {"name": "يوسف"} and items[0]["old_value"] is None
    assert items[1]["old_value"] == {"x": 1}

    only_one, total = await audit.list_entries(db, student_id=1)
    assert total == 1 and only_one[0]["action"] == "A"
