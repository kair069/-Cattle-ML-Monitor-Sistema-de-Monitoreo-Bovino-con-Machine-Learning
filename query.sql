USE monitoreo_vacas;

SELECT 
    s.id as sensor_id,
    s.id_collar,
    s.accel_x,
    s.accel_y,
    s.accel_z,
    s.gyro_x,
    s.gyro_y,
    s.gyro_z,
    s.temp,
    s.bateria,
    s.fecha,
    v.id as vaca_id,
    v.nombre as nombre_vaca,
    v.raza,
    v.codigo_identificacion,
    v.peso,
    v.sexo,
    v.fecha_nacimiento,
    v.estado as estado_vaca,
    c.id as collar_id,
    c.codigo_serial as collar_codigo,
    c.fecha_registro as collar_fecha_registro,
    cva.fecha_inicio as asignacion_inicio,
    cva.fecha_fin as asignacion_fin
FROM monitoreo_vacas_sensores s
INNER JOIN monitoreo_vacas_collar_vaca_asignaciones cva ON s.id_collar = cva.id_collar
INNER JOIN monitoreo_vacas_vacas v ON cva.id_vaca = v.id
INNER JOIN monitoreo_vacas_collares c ON cva.id_collar = c.id
WHERE v.estado = 'activa'
AND cva.fecha_fin IS NULL
ORDER BY v.nombre, s.fecha DESC;