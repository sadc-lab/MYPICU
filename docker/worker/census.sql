-- Adapted from my-screening/Backend/core/patient_window.py UNIT_STAY_CTE.
-- Also retrieve tracked encounters outside the window to obtain exact discharge
-- times after an outage. This query never writes to ICCA.
WITH ranked AS (
  SELECT pc.*, row_number() OVER (PARTITION BY pc.encounterid ORDER BY
    (pc.outtime IS NULL) DESC,
    (pc.outtime IS NOT NULL AND pc.outtime-pc.intime < interval '1 hour') ASC,
    pc.intime DESC) AS rn
  FROM readonly.ptcensus pc
  WHERE coalesce(pc.outtime, 'infinity'::timestamp) > now() - (%s * interval '1 day')
     OR pc.encounterid = ANY(%s)
)
SELECT us.encounterid, us.intime, us.outtime, us.clinicalunitid,
  concat_ws(', ', nullif(de.lastname,''), nullif(de.firstname,'')) AS name,
  CASE WHEN de.dateofbirth IS NULL THEN '—' ELSE
    extract(year FROM age(now(),de.dateofbirth))::int || 'y ' ||
    extract(month FROM age(now(),de.dateofbirth))::int || 'm ' ||
    extract(day FROM age(now(),de.dateofbirth))::int || 'd' END AS age,
  weight.valuenumber AS weight, bed.bedlabel,
  gcs.valuenumber AS gcs,
  de.dateofbirth AS dateofbirth
FROM ranked us
JOIN readonly.d_encounter de USING (encounterid)
LEFT JOIN LATERAL (
  SELECT valuenumber FROM readonly.ptassessment
  WHERE encounterid=us.encounterid AND attributeid=95805
  ORDER BY charttime DESC LIMIT 1
) weight ON true
LEFT JOIN LATERAL (
  SELECT bedlabel FROM readonly.ptbedstay WHERE encounterid=us.encounterid
  ORDER BY intime DESC LIMIT 1
) bed ON true
-- Glasgow total (53122). Read from valuenumber: terseform is text and varies
-- in width, so it would need re-parsing on every census row.
LEFT JOIN LATERAL (
  SELECT valuenumber FROM readonly.ptassessment
  WHERE encounterid=us.encounterid AND attributeid=53122 AND valuenumber IS NOT NULL
  ORDER BY charttime DESC LIMIT 1
) gcs ON true
WHERE us.rn=1
ORDER BY us.intime DESC;
