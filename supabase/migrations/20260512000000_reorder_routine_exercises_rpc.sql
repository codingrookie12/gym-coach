-- GYM-83: Atomic reorder of routine exercises within a split.
-- Replaces per-row PATCH loop in the client with a single transactional update.

CREATE OR REPLACE FUNCTION public.reorder_routine_exercises(
  p_split_id uuid,
  p_ordered_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_expected int := COALESCE(array_length(p_ordered_ids, 1), 0);
  v_owned int;
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_expected = 0 THEN
    RETURN;
  END IF;

  -- Verify every id belongs to the caller AND the named split.
  -- If any row is missing, refuse to write — no partial reorder.
  SELECT count(*) INTO v_owned
  FROM user_routine_exercises
  WHERE id = ANY(p_ordered_ids)
    AND user_id = v_uid
    AND user_program_split_id = p_split_id;

  IF v_owned <> v_expected THEN
    RAISE EXCEPTION 'reorder_routine_exercises: % of % ids do not belong to user/split',
      v_expected - v_owned, v_expected
      USING ERRCODE = '42501';
  END IF;

  -- Single statement, transactional. ordinality is 1-based; subtract 1 for 0-based sort_order.
  WITH new_positions AS (
    SELECT id, (ord - 1)::smallint AS sort_order
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS t(id, ord)
  )
  UPDATE user_routine_exercises ure
  SET sort_order = np.sort_order
  FROM new_positions np
  WHERE ure.id = np.id
    AND ure.user_id = v_uid
    AND ure.user_program_split_id = p_split_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> v_expected THEN
    RAISE EXCEPTION 'reorder_routine_exercises: updated % rows, expected %', v_updated, v_expected;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_routine_exercises(uuid, uuid[]) TO authenticated;
