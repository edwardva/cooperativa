-- Buscar socios sin que estorben los acentos: "maria" tiene que encontrar a
-- "MARÍA". `unaccent` viene con PostgreSQL y quita las tildes al comparar.
CREATE EXTENSION IF NOT EXISTS unaccent;
