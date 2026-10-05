SELECT set_chunk_time_interval('positions', INTERVAL '1 hour');

SELECT add_retention_policy('positions', INTERVAL '24 hours', schedule_interval => INTERVAL '1 hour', if_not_exists => TRUE);
