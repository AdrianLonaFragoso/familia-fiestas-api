-- Contenido aprobado de la minuta. Ejecutar una vez después del parche de esquema.
-- Idempotente por slug/ID; no borra personas ni confirmaciones. No se ejecuta en build.
DO $$
DECLARE venue_uuid uuid; event_uuid uuid;
BEGIN
SELECT id INTO venue_uuid FROM venues WHERE name='Casa Pipes' ORDER BY updated_at LIMIT 1;
IF venue_uuid IS NULL THEN INSERT INTO venues (id,name) VALUES ('44a3d18b-9ec1-5c9d-ab50-8625a7124c0b','Casa Pipes') RETURNING id INTO venue_uuid; END IF;
INSERT INTO events (id,slug,name,event_date,venue_id,description,is_released,gift_exchange_enabled) VALUES ('4cfc3c06-6fe0-5630-b38e-820fc722aee4','navidad','Cena de Navidad','2026-12-24',venue_uuid,'Compartamos en familia nuestra posada y cena navideña.',true,true) ON CONFLICT (slug) DO UPDATE SET name=excluded.name, event_date=excluded.event_date, venue_id=excluded.venue_id, description=excluded.description, updated_at=now() RETURNING id INTO event_uuid;
UPDATE events SET contributions='Anfitriones: plato fuerte y organización general.
Familia de Jimena: piñatas y aguinaldos.
Marlén: ensalada y pasta.
Patti: postre, letanías, velas y luces de bengala.
Pato y Dafne: ponche tradicional y ponche con vino caliente.
Familia de Adrián: refrescos.
Cada familia: 5 artículos de canasta básica como regalos para los juegos.', observations='Cada casa proporcionará bebidas básicas. Puedes llevar cerveza, vino u otras bebidas de tu preferencia.',registration_deadline='2026-11-26',dress_code='Suéter navideño y jeans.',exchange_rules='Solo participan los adultos que asistan a Navidad, el 24 de diciembre.
Presupuesto máximo: $500 MXN por participante.
Comparte 3 opciones de regalo al registrarte.
Está prohibido regalar dinero en efectivo, monederos electrónicos, tarjetas de regalo o equivalentes. Evita regalar termos.
Adrián organizará el sorteo digital y enviará las asignaciones una vez reunidas las confirmaciones. El módulo de sorteo está en construcción.',additional_activities='25 de diciembre de 2026: entrega de aguinaldos en la iglesia de Tejeda. Asistencia opcional. Horario tentativo: 18:00 h, por confirmar.' WHERE id=event_uuid;
INSERT INTO announcements (id,event_id,title,content,category,priority,is_active) VALUES ('dc81b6e1-2588-5f29-9f15-74f22fe3e964',event_uuid,'Confirma tu asistencia a más tardar el 26 de noviembre','La fecha límite para confirmar asistencia es el jueves 26 de noviembre de 2026. Regístrate y selecciona las celebraciones a las que asistirás.','general','importante',true) ON CONFLICT (id) DO UPDATE SET title=excluded.title,content=excluded.content;
SELECT id INTO venue_uuid FROM venues WHERE name='Casa Jimena y Adrián' ORDER BY updated_at LIMIT 1;
IF venue_uuid IS NULL THEN INSERT INTO venues (id,name) VALUES ('b5fa691c-fc07-5ac2-a1fe-bb003a5a4a52','Casa Jimena y Adrián') RETURNING id INTO venue_uuid; END IF;
INSERT INTO events (id,slug,name,event_date,venue_id,description,is_released,gift_exchange_enabled) VALUES ('ad03c9da-02a1-5838-8ac1-b0f793b2cc52','ano-nuevo','Cena de Año Nuevo','2026-12-31',venue_uuid,'Despidamos el año y recibamos juntos el 2027.',true,false) ON CONFLICT (slug) DO UPDATE SET name=excluded.name, event_date=excluded.event_date, venue_id=excluded.venue_id, description=excluded.description, updated_at=now() RETURNING id INTO event_uuid;
UPDATE events SET contributions='Anfitriones: plato fuerte y organización general.
Marlén: ensalada y pasta.
Nidia: besos de nuez.
Pipes: refrescos y sidra.', observations='Cada casa proporcionará bebidas básicas. Puedes llevar cerveza, vino u otras bebidas de tu preferencia.',registration_deadline='2026-11-26' WHERE id=event_uuid;
INSERT INTO event_hosts (id,event_id,name,sort_order) SELECT '275f8abb-5e58-5334-8f53-ad2c190de1e9',event_uuid,'Jimena',0 WHERE NOT EXISTS (SELECT 1 FROM event_hosts WHERE event_id=event_uuid AND name='Jimena');
INSERT INTO event_hosts (id,event_id,name,sort_order) SELECT 'e854845f-6f6a-5456-b898-3e1de6fb3734',event_uuid,'Adrián',1 WHERE NOT EXISTS (SELECT 1 FROM event_hosts WHERE event_id=event_uuid AND name='Adrián');
INSERT INTO announcements (id,event_id,title,content,category,priority,is_active) VALUES ('f04b2d38-472e-550c-9dcb-5a5300540289',event_uuid,'Confirma tu asistencia a más tardar el 26 de noviembre','La fecha límite para confirmar asistencia es el jueves 26 de noviembre de 2026. Regístrate y selecciona las celebraciones a las que asistirás.','general','importante',true) ON CONFLICT (id) DO UPDATE SET title=excluded.title,content=excluded.content;
SELECT id INTO venue_uuid FROM venues WHERE name='Casa de Marlén' ORDER BY updated_at LIMIT 1;
IF venue_uuid IS NULL THEN INSERT INTO venues (id,name) VALUES ('a95908ed-7a22-5754-af0e-451429ecb975','Casa de Marlén') RETURNING id INTO venue_uuid; END IF;
INSERT INTO events (id,slug,name,event_date,venue_id,description,is_released,gift_exchange_enabled) VALUES ('46aea01b-2e6c-53c4-8968-e92139ff1b77','rosca-de-reyes-2027','Rosca de Reyes','2027-01-06',venue_uuid,'Compartiremos la Rosca de Reyes en familia. Horario y detalles por confirmar.',false,false) ON CONFLICT (slug) DO UPDATE SET name=excluded.name, event_date=excluded.event_date, venue_id=excluded.venue_id, description=excluded.description, updated_at=now() RETURNING id INTO event_uuid;
SELECT id INTO venue_uuid FROM venues WHERE name='Casa de Paty' ORDER BY updated_at LIMIT 1;
IF venue_uuid IS NULL THEN INSERT INTO venues (id,name) VALUES ('4414bcb7-175f-5f37-abba-6608fa3e37d0','Casa de Paty') RETURNING id INTO venue_uuid; END IF;
INSERT INTO events (id,slug,name,event_date,venue_id,description,is_released,gift_exchange_enabled) VALUES ('658700ac-52f5-5eca-ab18-46afc0d83260','levantada-del-nino-dios-2027','Levantada del Niño Dios','2027-02-02',venue_uuid,'Nos reuniremos para la Levantada del Niño Dios y una merienda con tamales y atole. Horario y detalles por confirmar.',false,false) ON CONFLICT (slug) DO UPDATE SET name=excluded.name, event_date=excluded.event_date, venue_id=excluded.venue_id, description=excluded.description, updated_at=now() RETURNING id INTO event_uuid;
UPDATE events SET arrival_time=NULL,start_time=NULL,dinner_time=NULL,end_time=NULL WHERE slug IN ('navidad','ano-nuevo');
UPDATE announcements SET is_active=false WHERE id='103e520b-ce2d-47b9-801f-088507f9e989' AND title='Fecha limite para suscripción';
END $;
