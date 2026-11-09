-- Audit log: link entries to a student so a student's history can be listed efficiently.

ALTER TABLE audit_log ADD COLUMN student_id INTEGER;

CREATE INDEX idx_audit_student ON audit_log(student_id);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_students_status ON students(status);
