CREATE SEQUENCE IF NOT EXISTS seq_material_id START 1;
CREATE TABLE IF NOT EXISTS materials (
    material_id BIGINT PRIMARY KEY DEFAULT nextval('seq_material_id'),
    paper_id VARCHAR UNIQUE NOT NULL,
    canonical_title VARCHAR NOT NULL,
    year INTEGER,
    venue VARCHAR,
    doi VARCHAR,
    arxiv_id VARCHAR,
    selected_version VARCHAR NOT NULL,
    curriculum_id VARCHAR NOT NULL,
    curriculum_stage VARCHAR NOT NULL,
    confidence VARCHAR NOT NULL,
    packet_path VARCHAR NOT NULL,
    packet_sha256 VARCHAR,
    created_at TIMESTAMPTZ DEFAULT current_timestamp,
    updated_at TIMESTAMPTZ DEFAULT current_timestamp
);
CREATE TABLE IF NOT EXISTS authors (
    paper_id VARCHAR NOT NULL,
    author_order INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    affiliation VARCHAR,
    orcid VARCHAR,
    PRIMARY KEY (paper_id, author_order)
);
CREATE TABLE IF NOT EXISTS concepts (
    paper_id VARCHAR NOT NULL,
    term VARCHAR NOT NULL,
    classification VARCHAR NOT NULL,
    importance VARCHAR NOT NULL,
    preliminary_definition VARCHAR,
    PRIMARY KEY (paper_id, term)
);
CREATE TABLE IF NOT EXISTS questions (
    paper_id VARCHAR NOT NULL,
    question_order INTEGER NOT NULL,
    dimension VARCHAR NOT NULL,
    question VARCHAR NOT NULL,
    PRIMARY KEY (paper_id, question_order)
);
CREATE TABLE IF NOT EXISTS recall_schedule (
    paper_id VARCHAR NOT NULL,
    recall_no INTEGER NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    result_path VARCHAR,
    PRIMARY KEY (paper_id, recall_no)
);
CREATE VIEW IF NOT EXISTS curriculum_progress AS
SELECT curriculum_stage, count(*) AS materials_prepared
FROM materials GROUP BY curriculum_stage ORDER BY curriculum_stage;
