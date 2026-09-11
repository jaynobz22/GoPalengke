/*
# Create get_order_trend function for analytics dashboard

## Purpose
Returns aggregated order volume grouped by a date format string, used by
the admin analytics dashboard to render daily/weekly/monthly trend charts.

## Security
SECURITY DEFINER so the admin (authenticated role) can read aggregated
order data without needing direct SELECT on all order rows. Returns only
date + volume, no user-identifiable data.
*/

CREATE OR REPLACE FUNCTION get_order_trend(p_start timestamptz, p_format text)
RETURNS TABLE (date text, orders bigint, volume numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(date_trunc('day', created_at), p_format) AS date,
    count(*)::bigint AS orders,
    COALESCE(sum(total), 0) AS volume
  FROM orders
  WHERE created_at >= p_start
    AND status <> 'cancelled'
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION get_order_trend TO authenticated;
