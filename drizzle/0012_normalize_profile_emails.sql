DO $$
BEGIN
  IF EXISTS (SELECT lower(btrim(email)) FROM users GROUP BY lower(btrim(email)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Resolve duplicate normalized profile emails before migrating';
  END IF;
END $$;
--> statement-breakpoint
UPDATE users SET email = lower(btrim(email)) WHERE email IS DISTINCT FROM lower(btrim(email));
