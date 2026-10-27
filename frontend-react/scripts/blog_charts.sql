-- Consultas del estudio de precios que alimenta scripts/blog_charts.py y los
-- posts de precios. Solo leen. Correrlas en prod como script, en una sola
-- sesión (la vista temporal desaparece al cerrarla), y exportar cada resultado.
-- Los montos son el precio del transportista: para publicar, sumar PLATFORM_FEE.


CREATE OR REPLACE TEMP VIEW qa AS
SELECT
  q.id, q.order_id, q.carrier_company_id AS carrier_id, q.amount, q.quotation_status_id AS status_id,
  q.created_date AS quoted_at, o.carrier_notified_at AS notified_at, o.appointment_date,
  coalesce(o.load_type, 'moving') AS load_type, o.cargo_weight_kg, o.total_kilometers AS km,
  o.approximate_budget AS budget, o.loaders_quantity AS loaders,
  substring(lower(o.comments) from '(\d+)\s*(?:dormitorio|habitaci|cuarto|ambiente)')::int AS bedrooms,
  fr.floor_number AS from_floor, fr.has_elevator AS from_elev,
  dt.floor_number AS to_floor, dt.has_elevator AS to_elev,
  initcap(trim(coalesce(fr.state, ''))) AS from_state, initcap(trim(coalesce(dt.state, ''))) AS to_state,
  initcap(trim(coalesce(dt.city, ''))) AS to_city,
  (coalesce(fr.state, '') ~* 'lima|callao' OR fr.zip_code ~ '^(15|07)')
    AND (coalesce(dt.state, '') ~* 'lima|callao' OR dt.zip_code ~ '^(15|07)') AS in_lima
FROM quotations q
JOIN orders o ON o.id = q.order_id
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN carrier_company cc ON cc.id = q.carrier_company_id
LEFT JOIN LATERAL (SELECT * FROM order_details d WHERE d.order_id = o.id AND d.type = 'carry_from' ORDER BY d.id LIMIT 1) fr ON true
LEFT JOIN LATERAL (SELECT * FROM order_details d WHERE d.order_id = o.id AND d.type = 'deliver_to' ORDER BY d.id LIMIT 1) dt ON true
WHERE q.quotation_status_id <> 3
  AND q.amount > 0
  AND coalesce(c.email, '') NOT ILIKE '%@chalan.pe'
  AND coalesce(c.email, '') NOT ILIKE '%@example.com'
  AND coalesce(cc.name, '') !~* 'prueba|test';

-- 0. Cuántos datos hay
SELECT count(*) AS cotizaciones, count(DISTINCT order_id) AS ordenes, count(DISTINCT carrier_id) AS transportistas,
       min(quoted_at)::date AS desde, max(quoted_at)::date AS hasta,
       count(*) FILTER (WHERE status_id = 2) AS elegidas,
       count(*) FILTER (WHERE km > 0) AS con_km, count(*) FILTER (WHERE budget > 0) AS con_presupuesto,
       count(*) FILTER (WHERE bedrooms IS NOT NULL) AS con_dormitorios
FROM qa;

-- 1. Precio por tipo de carga, dentro de Lima vs interprovincial
SELECT load_type, CASE WHEN in_lima THEN 'lima' ELSE 'fuera' END AS zona,
       count(*) AS n, count(DISTINCT order_id) AS ordenes, count(DISTINCT carrier_id) AS transp,
       round(percentile_cont(0.25) WITHIN GROUP (ORDER BY amount)) AS p25,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY amount)) AS mediana,
       round(percentile_cont(0.75) WITHIN GROUP (ORDER BY amount)) AS p75,
       min(amount) AS min, max(amount) AS max
FROM qa GROUP BY 1, 2 ORDER BY 1, 2;

-- 2. Mudanzas dentro de Lima por distancia
SELECT CASE WHEN km IS NULL OR km = 0 THEN 'sin km' WHEN km <= 5 THEN '0-5' WHEN km <= 10 THEN '5-10'
            WHEN km <= 20 THEN '10-20' WHEN km <= 40 THEN '20-40' ELSE '40+' END AS km,
       count(*) AS n, count(DISTINCT carrier_id) AS transp,
       round(percentile_cont(0.25) WITHIN GROUP (ORDER BY amount)) AS p25,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY amount)) AS mediana,
       round(percentile_cont(0.75) WITHIN GROUP (ORDER BY amount)) AS p75
FROM qa WHERE in_lima AND load_type = 'moving' GROUP BY 1 ORDER BY min(coalesce(km, -1));

-- 3. Mudanzas dentro de Lima por dormitorios mencionados (en 2026-10 ningún comentario los traía)
SELECT CASE WHEN bedrooms IS NULL THEN 'sin dato' ELSE least(bedrooms, 4)::text END AS dormitorios,
       count(*) AS n, count(DISTINCT carrier_id) AS transp,
       round(percentile_cont(0.25) WITHIN GROUP (ORDER BY amount)) AS p25,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY amount)) AS mediana,
       round(percentile_cont(0.75) WITHIN GROUP (ORDER BY amount)) AS p75
FROM qa WHERE in_lima AND load_type = 'moving' GROUP BY 1 ORDER BY 1;

-- 4. Piso más alto sin ascensor (mudanzas dentro de Lima)
SELECT CASE WHEN m <= 1 THEN '1 o con ascensor' WHEN m <= 3 THEN '2-3 sin ascensor' ELSE '4+ sin ascensor' END AS piso,
       count(*) AS n, count(DISTINCT carrier_id) AS transp,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)) AS mediana
FROM (SELECT amount, carrier_id,
             greatest(CASE WHEN coalesce(from_elev, 0) = 0 THEN coalesce(from_floor, 1) ELSE 1 END,
                      CASE WHEN coalesce(to_elev, 0) = 0 THEN coalesce(to_floor, 1) ELSE 1 END) AS m
      FROM qa WHERE in_lima AND load_type = 'moving') x
GROUP BY 1 ORDER BY 1;

-- 5. Rutas fuera de Lima (al menos 3 cotizaciones)
SELECT from_state, to_state, count(*) AS n, count(DISTINCT order_id) AS ordenes, count(DISTINCT carrier_id) AS transp,
       round(percentile_cont(0.25) WITHIN GROUP (ORDER BY amount)) AS p25,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY amount)) AS mediana,
       round(percentile_cont(0.75) WITHIN GROUP (ORDER BY amount)) AS p75,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY km)) AS km_mediana,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY amount::numeric / nullif(km, 0)))::numeric, 2) AS soles_por_km
FROM qa WHERE NOT in_lima GROUP BY 1, 2 HAVING count(*) >= 3 ORDER BY n DESC;

-- 6. Cuánto varían las cotizaciones de una misma orden
SELECT load_type, count(*) AS ordenes, round(avg(n), 1) AS cotiz_promedio,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY (mx - mn) / mx) * 100) AS dif_mediana_pct,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY mx - mn)) AS dif_mediana_soles,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY mx / mn)::numeric, 2) AS cara_entre_barata
FROM (SELECT order_id, load_type, count(*) AS n, max(amount)::numeric AS mx, min(amount)::numeric AS mn
      FROM qa GROUP BY 1, 2 HAVING count(*) >= 2) x
GROUP BY 1;

-- 7. Presupuesto del cliente vs cotizaciones
SELECT count(*) AS ordenes,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY med / budget)::numeric, 2) AS mediana_cotiz_entre_presupuesto,
       count(*) FILTER (WHERE budget < mn) AS presupuesto_bajo_la_mas_barata,
       count(*) FILTER (WHERE budget >= med) AS presupuesto_sobre_la_mediana
FROM (SELECT order_id, max(budget)::numeric AS budget, min(amount)::numeric AS mn,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)::numeric AS med
      FROM qa WHERE budget > 0 GROUP BY 1) x;

-- 8. Cuánto tardan en llegar las cotizaciones (desde que se avisó a los transportistas)
SELECT count(*) AS ordenes,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY h)::numeric, 1) AS horas_1ra_mediana,
       round(percentile_cont(0.75) WITHIN GROUP (ORDER BY h)::numeric, 1) AS horas_1ra_p75,
       count(*) FILTER (WHERE h <= 1) AS en_1h, count(*) FILTER (WHERE h <= 6) AS en_6h,
       count(*) FILTER (WHERE h <= 24) AS en_24h
FROM (SELECT order_id, extract(epoch FROM min(quoted_at) - min(notified_at)) / 3600 AS h
      FROM qa WHERE notified_at IS NOT NULL GROUP BY 1) x WHERE h >= 0;

-- 9. Día de la semana de la mudanza (dentro de Lima)
SELECT to_char(appointment_date, 'ID Dy') AS dia, count(*) AS n,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)) AS mediana
FROM qa WHERE in_lima AND load_type = 'moving' GROUP BY 1 ORDER BY 1;

-- 10. Carga por peso
SELECT cargo_weight_kg, CASE WHEN in_lima THEN 'lima' ELSE 'fuera' END AS zona, count(*) AS n,
       count(DISTINCT carrier_id) AS transp,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)) AS mediana
FROM qa WHERE load_type = 'cargo' GROUP BY 1, 2 ORDER BY 1, 2;

-- 11. Servicios (embalaje, armado, pintura)
SELECT st.code AS servicio, count(*) AS n, count(DISTINCT sq.service_request_id) AS solicitudes,
       count(DISTINCT sq.carrier_company_id) AS transp,
       round(percentile_cont(0.25) WITHIN GROUP (ORDER BY sq.amount)) AS p25,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY sq.amount)) AS mediana,
       round(percentile_cont(0.75) WITHIN GROUP (ORDER BY sq.amount)) AS p75,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY sq.amount / nullif((sr.details::jsonb ->> 'area_m2')::numeric, 0))::numeric, 1) AS soles_m2_pintura
FROM service_request_quotations sq
JOIN service_requests sr ON sr.id = sq.service_request_id
JOIN lu_service_types st ON st.id = sr.service_type_id
GROUP BY 1 ORDER BY 1;

-- 12. Por qué no cotizan
SELECT reason, count(*) AS n FROM order_carrier_declines GROUP BY 1 ORDER BY n DESC;

-- 13. Rutas: departamento de cada extremo por código postal, o el último nombre de lugar del texto ("Av. Arequipa, Lima" es Lima).
WITH d AS (
  SELECT q.order_id, q.carrier_company_id AS carrier_id, q.amount, coalesce(o.load_type, 'moving') AS load_type,
         (SELECT CASE WHEN x.zip_code ~ '^(15|07)' THEN 'Lima' ELSE initcap(substring(lower(concat_ws(' ', x.street, x.city, x.state))
                  from '^.*\m(lima|callao|arequipa|cusco|cuzco|piura|la libertad|trujillo|lambayeque|chiclayo|jun[ií]n|huancayo|ica|ancash|[áa]ncash|chimbote|huaraz|cajamarca|puno|juliaca|tacna|moquegua|ayacucho|huancavelica|hu[aá]nuco|pasco|loreto|iquitos|ucayali|pucallpa|san mart[ií]n|tarapoto|amazonas|tumbes|apur[ií]mac|madre de dios)\M')) END
            FROM order_details x WHERE x.order_id = o.id AND x.type = 'carry_from' ORDER BY x.id LIMIT 1) AS desde,
         (SELECT CASE WHEN x.zip_code ~ '^(15|07)' THEN 'Lima' ELSE initcap(substring(lower(concat_ws(' ', x.street, x.city, x.state))
                  from '^.*\m(lima|callao|arequipa|cusco|cuzco|piura|la libertad|trujillo|lambayeque|chiclayo|jun[ií]n|huancayo|ica|ancash|[áa]ncash|chimbote|huaraz|cajamarca|puno|juliaca|tacna|moquegua|ayacucho|huancavelica|hu[aá]nuco|pasco|loreto|iquitos|ucayali|pucallpa|san mart[ií]n|tarapoto|amazonas|tumbes|apur[ií]mac|madre de dios)\M')) END
            FROM order_details x WHERE x.order_id = o.id AND x.type = 'deliver_to' ORDER BY x.id LIMIT 1) AS hasta
  FROM quotations q
  JOIN orders o ON o.id = q.order_id
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN carrier_company cc ON cc.id = q.carrier_company_id
  WHERE q.quotation_status_id <> 3 AND q.amount > 0
    AND coalesce(c.email, '') NOT ILIKE '%@chalan.pe' AND coalesce(c.email, '') NOT ILIKE '%@example.com'
    AND coalesce(cc.name, '') !~* 'prueba|test'
)
SELECT load_type, coalesce(desde, '?') AS desde, coalesce(hasta, '?') AS hasta,
       count(*) AS n, count(DISTINCT order_id) AS ordenes, count(DISTINCT carrier_id) AS transp,
       round(percentile_cont(0.25) WITHIN GROUP (ORDER BY amount)) AS p25,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY amount)) AS mediana,
       round(percentile_cont(0.75) WITHIN GROUP (ORDER BY amount)) AS p75
FROM d GROUP BY 1, 2, 3 ORDER BY n DESC;
