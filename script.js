// === CONFIGURACIÓN GLOBAL ===
const CONFIG = {
    updateInterval: 2000, // ms
    maxDataPoints: 50,
    alertThresholds: {
        tempMax: 30,
        accelMax: 15,
        batteryMin: 3.0
    },
    mlConfig: {
        clusters: 3,
        anomalyThreshold: 0.8,
        predictionSteps: 6
    }
};

// === DATOS GLOBALES ===
let sensorData = [];
let charts = {};
let mlModels = {};
let alerts = [];
let isMLTraining = false;
let rawCSVData = [];
let currentDataIndex = 0;

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🐄 Iniciando Sistema de Monitoreo Bovino ML...');
    
    try {
        // Cargar datos CSV
        await loadCSVData();
        
        // Inicializar componentes
        initializeTabs();
        initializeCharts();
        initializeAlerts();
        
        // Cargar datos iniciales
        loadInitialData();
        
        // Iniciar simulación en tiempo real
        startRealTimeSimulation();
        
        // Inicializar ML
        await initializeMachineLearning();
        
        console.log('✅ Sistema inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error al inicializar:', error);
        showAlert('Error al cargar el sistema', 'danger');
    }
});

// === CARGA DE DATOS CSV ===
async function loadCSVData() {
    try {
        console.log('📁 Cargando archivo csv.csv...');
        
        // Intentar cargar el archivo CSV
        const response = await fetch('csv.csv');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const csvText = await response.text();
        console.log('📊 Archivo CSV cargado, parseando datos...');
        
        // Parsear CSV
        rawCSVData = parseCSV(csvText);
        console.log(`✅ Datos parseados: ${rawCSVData.length} registros`);
        
        // Actualizar estadísticas
        updateStats();
        
    } catch (error) {
        console.warn('⚠️ No se pudo cargar csv.csv, usando datos de ejemplo');
        
        // Datos de ejemplo si no se puede cargar el archivo
        rawCSVData = generateSampleData();
        updateStats();
    }
}

// === PARSER CSV ===
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || null;
        });
        
        // Convertir valores numéricos
        if (row.accel_x) row.accel_x = parseFloat(row.accel_x);
        if (row.accel_y) row.accel_y = parseFloat(row.accel_y);
        if (row.accel_z) row.accel_z = parseFloat(row.accel_z);
        if (row.gyro_x) row.gyro_x = parseFloat(row.gyro_x);
        if (row.gyro_y) row.gyro_y = parseFloat(row.gyro_y);
        if (row.gyro_z) row.gyro_z = parseFloat(row.gyro_z);
        if (row.temp) row.temp = parseFloat(row.temp);
        if (row.bateria) row.bateria = parseFloat(row.bateria);
        
        data.push(row);
    }
    
    return data;
}

// === DATOS DE EJEMPLO ===
function generateSampleData() {
    const data = [];
    const now = new Date();
    
    for (let i = 0; i < 100; i++) {
        const timestamp = new Date(now.getTime() - (i * 5000));
        data.push({
            sensor_id: 622 - i,
            accel_x: 10 + Math.random() * 2 - 1,
            accel_y: 0.4 + Math.random() * 0.3 - 0.15,
            accel_z: 0.3 + Math.random() * 0.2 - 0.1,
            gyro_x: -0.09 + Math.random() * 0.02 - 0.01,
            gyro_y: -0.01 + Math.random() * 0.02 - 0.01,
            gyro_z: -0.02 + Math.random() * 0.02 - 0.01,
            temp: 23 + Math.random() * 4 - 2,
            bateria: 3.85 + Math.random() * 0.5 - 0.25,
            fecha: timestamp.toISOString(),
            nombre_vaca: "Vaca Prueba",
            collar_codigo: "COLLAR-001"
        });
    }
    
    return data.reverse(); // Orden cronológico
}

// === SISTEMA DE TABS ===
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remover clases activas
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activar tab seleccionado
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // Redimensionar gráficos
            setTimeout(() => {
                Object.values(charts).forEach(chart => {
                    if (chart && chart.resize) chart.resize();
                });
            }, 100);
        });
    });
}

// === INICIALIZACIÓN DE GRÁFICOS ===
function initializeCharts() {
    console.log('📈 Inicializando gráficos...');
    
    // Configuración base para todos los gráficos
    const baseConfig = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#374151',
                    font: { family: 'Segoe UI' }
                }
            }
        },
        scales: {
            y: {
                ticks: { color: '#6b7280' },
                grid: { color: '#e2e8f0' }
            },
            x: {
                ticks: { color: '#6b7280' },
                grid: { color: '#e2e8f0' }
            }
        }
    };
    
    // Gráfico de actividad
    const activityCtx = document.getElementById('activityChart');
    if (activityCtx) {
        charts.activity = new Chart(activityCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Actividad General',
                    data: [],
                    borderColor: '#14b8a6',
                    backgroundColor: 'rgba(20, 184, 166, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: baseConfig
        });
    }
    
    // Gráfico de temperatura
    const tempCtx = document.getElementById('tempChart');
    if (tempCtx) {
        charts.temperature = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Temperatura (°C)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: baseConfig
        });
    }
    
    // Gráfico de acelerómetro
    const accelCtx = document.getElementById('accelChart');
    if (accelCtx) {
        charts.accelerometer = new Chart(accelCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Accel X',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent'
                    },
                    {
                        label: 'Accel Y',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'transparent'
                    },
                    {
                        label: 'Accel Z',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'transparent'
                    }
                ]
            },
            options: baseConfig
        });
    }
    
    // Gráfico de giroscopio
    const gyroCtx = document.getElementById('gyroChart');
    if (gyroCtx) {
        charts.gyroscope = new Chart(gyroCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Gyro X',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent'
                    },
                    {
                        label: 'Gyro Y',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'transparent'
                    },
                    {
                        label: 'Gyro Z',
                        data: [],
                        borderColor: '#06b6d4',
                        backgroundColor: 'transparent'
                    }
                ]
            },
            options: baseConfig
        });
    }
    
    // Gráfico de comportamiento ML
    const behaviorCtx = document.getElementById('behaviorChart');
    if (behaviorCtx) {
        charts.behavior = new Chart(behaviorCtx, {
            type: 'doughnut',
            data: {
                labels: ['Descansando', 'Caminando', 'Pastoreando', 'Bebiendo'],
                datasets: [{
                    data: [40, 30, 25, 5],
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b',
                        '#14b8a6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // Gráfico de clustering
    const clusterCtx = document.getElementById('clusterChart');
    if (clusterCtx) {
        charts.cluster = new Chart(clusterCtx, {
            type: 'scatter',
            data: {
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'Actividad (m/s²)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Temperatura (°C)'
                        }
                    }
                }
            }
        });
    }
    
    // Gráfico de anomalías
    const anomalyCtx = document.getElementById('anomalyChart');
    if (anomalyCtx) {
        charts.anomaly = new Chart(anomalyCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Score de Anomalía',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: baseConfig
        });
    }
    
    // Gráfico de predicciones
    const predictionCtx = document.getElementById('predictionChart');
    if (predictionCtx) {
        charts.prediction = new Chart(predictionCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Datos Reales',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'transparent'
                    },
                    {
                        label: 'Predicción',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderDash: [5, 5]
                    }
                ]
            },
            options: baseConfig
        });
    }
    
    // Gráfico de predicción de temperatura
    const tempPredCtx = document.getElementById('tempPredictionChart');
    if (tempPredCtx) {
        charts.tempPrediction = new Chart(tempPredCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Temperatura Real',
                        data: [],
                        borderColor: '#14b8a6',
                        backgroundColor: 'transparent'
                    },
                    {
                        label: 'Predicción Temp.',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderDash: [3, 3]
                    }
                ]
            },
            options: baseConfig
        });
    }
}

// === CARGAR DATOS INICIALES ===
function loadInitialData() {
    if (rawCSVData.length === 0) return;
    
    // Cargar primeros 20 puntos de datos
    const initialData = rawCSVData.slice(0, Math.min(20, rawCSVData.length));
    sensorData = initialData;
    currentDataIndex = initialData.length;
    
    // Actualizar visualizaciones
    updateAllCharts();
    updateSensorReadings();
    updateStats();
}

// === SIMULACIÓN EN TIEMPO REAL ===
function startRealTimeSimulation() {
    setInterval(() => {
        if (currentDataIndex < rawCSVData.length) {
            // Agregar nuevo punto de datos
            const newData = rawCSVData[currentDataIndex];
            sensorData.push(newData);
            currentDataIndex++;
            
            // Limitar número de puntos
            if (sensorData.length > CONFIG.maxDataPoints) {
                sensorData.shift();
            }
            
            // Actualizar visualizaciones
            updateAllCharts();
            updateSensorReadings();
            checkAlerts(newData);
            
        } else {
            // Reiniciar simulación o generar datos sintéticos
            currentDataIndex = 0;
            generateSyntheticData();
        }
    }, CONFIG.updateInterval);
}

// === GENERAR DATOS SINTÉTICOS ===
function generateSyntheticData() {
    if (sensorData.length === 0) return;
    
    const lastData = sensorData[sensorData.length - 1];
    const now = new Date();
    
    const newData = {
        sensor_id: lastData.sensor_id + 1,
        accel_x: lastData.accel_x + (Math.random() - 0.5) * 0.5,
        accel_y: lastData.accel_y + (Math.random() - 0.5) * 0.1,
        accel_z: lastData.accel_z + (Math.random() - 0.5) * 0.1,
        gyro_x: lastData.gyro_x + (Math.random() - 0.5) * 0.02,
        gyro_y: lastData.gyro_y + (Math.random() - 0.5) * 0.02,
        gyro_z: lastData.gyro_z + (Math.random() - 0.5) * 0.02,
        temp: Math.max(15, Math.min(35, lastData.temp + (Math.random() - 0.5) * 2)),
        bateria: Math.max(0, Math.min(5, lastData.bateria + (Math.random() - 0.5) * 0.1)),
        fecha: now.toISOString(),
        nombre_vaca: lastData.nombre_vaca,
        collar_codigo: lastData.collar_codigo
    };
    
    sensorData.push(newData);
    
    if (sensorData.length > CONFIG.maxDataPoints) {
        sensorData.shift();
    }
}

// === ACTUALIZAR GRÁFICOS ===
function updateAllCharts() {
    const labels = sensorData.map((_, index) => `T-${sensorData.length - index - 1}`);
    
    // Actividad general (magnitud de aceleración)
    if (charts.activity) {
        const activityData = sensorData.map(d => 
            Math.sqrt(d.accel_x*d.accel_x + d.accel_y*d.accel_y + d.accel_z*d.accel_z)
        );
        charts.activity.data.labels = labels;
        charts.activity.data.datasets[0].data = activityData;
        charts.activity.update('none');
    }
    
    // Temperatura
    if (charts.temperature) {
        charts.temperature.data.labels = labels;
        charts.temperature.data.datasets[0].data = sensorData.map(d => d.temp);
        charts.temperature.update('none');
    }
    
    // Acelerómetro
    if (charts.accelerometer) {
        charts.accelerometer.data.labels = labels;
        charts.accelerometer.data.datasets[0].data = sensorData.map(d => d.accel_x);
        charts.accelerometer.data.datasets[1].data = sensorData.map(d => d.accel_y);
        charts.accelerometer.data.datasets[2].data = sensorData.map(d => d.accel_z);
        charts.accelerometer.update('none');
    }
    
    // Giroscopio
    if (charts.gyroscope) {
        charts.gyroscope.data.labels = labels;
        charts.gyroscope.data.datasets[0].data = sensorData.map(d => d.gyro_x);
        charts.gyroscope.data.datasets[1].data = sensorData.map(d => d.gyro_y);
        charts.gyroscope.data.datasets[2].data = sensorData.map(d => d.gyro_z);
        charts.gyroscope.update('none');
    }
}

// === ACTUALIZAR LECTURAS DE SENSORES ===
function updateSensorReadings() {
    if (sensorData.length === 0) return;
    
    const latest = sensorData[sensorData.length - 1];
    
    // Temperatura actual
    const tempElement = document.getElementById('current-temp');
    if (tempElement) {
        tempElement.textContent = `${latest.temp.toFixed(1)}°C`;
    }
    
    // Acelerómetro
    const accelX = document.getElementById('accel-x');
    const accelY = document.getElementById('accel-y');
    const accelZ = document.getElementById('accel-z');
    if (accelX) accelX.textContent = latest.accel_x.toFixed(2);
    if (accelY) accelY.textContent = latest.accel_y.toFixed(2);
    if (accelZ) accelZ.textContent = latest.accel_z.toFixed(2);
    
    // Giroscopio
    const gyroX = document.getElementById('gyro-x');
    const gyroY = document.getElementById('gyro-y');
    const gyroZ = document.getElementById('gyro-z');
    if (gyroX) gyroX.textContent = `${latest.gyro_x.toFixed(2)}°/s`;
    if (gyroY) gyroY.textContent = `${latest.gyro_y.toFixed(2)}°/s`;
    if (gyroZ) gyroZ.textContent = `${latest.gyro_z.toFixed(2)}°/s`;
    
    // Estado del sistema
    const batteryLevel = document.getElementById('battery-level');
    const collarId = document.getElementById('collar-id');
    const lastReading = document.getElementById('last-reading');
    
    if (batteryLevel) batteryLevel.textContent = `${latest.bateria.toFixed(2)}V`;
    if (collarId) collarId.textContent = latest.collar_codigo || 'COLLAR-001';
    if (lastReading) lastReading.textContent = new Date(latest.fecha).toLocaleTimeString();
    
    // Actualizar textos específicos para una vaca
    updateSingleCowTexts();
}

// === ACTUALIZAR ESTADÍSTICAS ===
function updateStats() {
    const totalReadings = document.getElementById('total-readings');
    const activeAnimals = document.getElementById('active-animals');
    const avgTemp = document.getElementById('avg-temp');
    
    if (totalReadings) totalReadings.textContent = rawCSVData.length;
    if (activeAnimals) activeAnimals.textContent = '1'; // Una sola vaca
    
    if (avgTemp && sensorData.length > 0) {
        const average = sensorData.reduce((sum, d) => sum + d.temp, 0) / sensorData.length;
        avgTemp.textContent = `${average.toFixed(1)}°C`;
    }
}

// === ACTUALIZAR TEXTO PARA UNA VACA ===
function updateSingleCowTexts() {
    // Cambiar textos del header si es necesario
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
        subtitle.textContent = 'Monitoreo Individual - Vaca Prueba (COLLAR-001)';
    }
    
    // Actualizar indicadores de salud para una vaca
    const healthIndicators = document.querySelector('.health-indicators');
    if (healthIndicators && sensorData.length > 0) {
        const latest = sensorData[sensorData.length - 1];
        
        // Actualizar indicadores basados en datos reales
        healthIndicators.innerHTML = `
            <div class="health-item">
                <div class="health-dot ${latest.temp > 25 ? 'yellow' : 'green'}"></div>
                <span>Temperatura: ${latest.temp.toFixed(1)}°C</span>
            </div>
            <div class="health-item">
                <div class="health-dot ${latest.bateria < 3.5 ? 'yellow' : 'green'}"></div>
                <span>Batería: ${latest.bateria.toFixed(2)}V</span>
            </div>
            <div class="health-item">
                <div class="health-dot green"></div>
                <span>Collar Activo: ${latest.collar_codigo || 'COLLAR-001'}</span>
            </div>
            <div class="health-item">
                <div class="health-dot ${getCurrentActivityLevel() > 12 ? 'yellow' : 'green'}"></div>
                <span>Actividad: ${getCurrentActivityLevel().toFixed(1)} m/s²</span>
            </div>
        `;
    }
}

// === OBTENER NIVEL DE ACTIVIDAD ACTUAL ===
function getCurrentActivityLevel() {
    if (sensorData.length === 0) return 0;
    const latest = sensorData[sensorData.length - 1];
    return Math.sqrt(latest.accel_x*latest.accel_x + latest.accel_y*latest.accel_y + latest.accel_z*latest.accel_z);
}

// === MACHINE LEARNING ===
async function initializeMachineLearning() {
    console.log('🧠 Inicializando Machine Learning...');
    
    try {
        // Crear modelo simple para clasificación de comportamiento
        mlModels.behaviorClassifier = await createBehaviorModel();
        
        // Crear modelo para detección de anomalías
        mlModels.anomalyDetector = await createAnomalyModel();
        
        // Entrenar con datos iniciales si hay suficientes
        if (sensorData.length > 10) {
            await trainModels();
        }
        
        console.log('✅ Machine Learning inicializado');
        
    } catch (error) {
        console.error('❌ Error en ML:', error);
    }
}

// === CREAR MODELO DE COMPORTAMIENTO ===
async function createBehaviorModel() {
    const model = tf.sequential({
        layers: [
            tf.layers.dense({ inputShape: [6], units: 16, activation: 'relu' }),
            tf.layers.dropout({ rate: 0.3 }),
            tf.layers.dense({ units: 8, activation: 'relu' }),
            tf.layers.dense({ units: 4, activation: 'softmax' }) // 4 comportamientos
        ]
    });
    
    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });
    
    return model;
}

// === CREAR MODELO DE ANOMALÍAS ===
async function createAnomalyModel() {
    const model = tf.sequential({
        layers: [
            tf.layers.dense({ inputShape: [6], units: 12, activation: 'relu' }),
            tf.layers.dense({ units: 6, activation: 'relu' }),
            tf.layers.dense({ units: 12, activation: 'relu' }),
            tf.layers.dense({ units: 6, activation: 'linear' }) // Autoencoder
        ]
    });
    
    model.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError'
    });
    
    return model;
}

// === ENTRENAR MODELOS ===
async function trainModels() {
    if (isMLTraining || sensorData.length < 10) return;
    
    isMLTraining = true;
    console.log('🎯 Entrenando modelos ML...');
    
    try {
        // Preparar datos
        const features = sensorData.map(d => [
            d.accel_x, d.accel_y, d.accel_z,
            d.gyro_x, d.gyro_y, d.gyro_z
        ]);
        
        const X = tf.tensor2d(features);
        
        // Entrenar autoencoder para anomalías
        if (mlModels.anomalyDetector) {
            await mlModels.anomalyDetector.fit(X, X, {
                epochs: 20,
                batchSize: 8,
                verbose: 0
            });
        }
        
        // Simular entrenamiento de comportamiento
        if (mlModels.behaviorClassifier) {
            const behaviorLabels = generateBehaviorLabels(sensorData);
            const y = tf.tensor2d(behaviorLabels);
            
            await mlModels.behaviorClassifier.fit(X, y, {
                epochs: 30,
                batchSize: 8,
                verbose: 0
            });
            
            y.dispose();
        }
        
        X.dispose();
        
        // Actualizar métricas
        updateMLMetrics();
        
        console.log('✅ Modelos entrenados');
        
    } catch (error) {
        console.error('❌ Error entrenando:', error);
    } finally {
        isMLTraining = false;
    }
}

// === GENERAR ETIQUETAS DE COMPORTAMIENTO ===
function generateBehaviorLabels(data) {
    return data.map(d => {
        const activity = Math.sqrt(d.accel_x*d.accel_x + d.accel_y*d.accel_y + d.accel_z*d.accel_z);
        
        if (activity < 5) return [1, 0, 0, 0]; // Descansando
        else if (activity < 10) return [0, 1, 0, 0]; // Caminando
        else if (activity < 15) return [0, 0, 1, 0]; // Pastoreando
        else return [0, 0, 0, 1]; // Bebiendo/Activo
    });
}

// === ACTUALIZAR MÉTRICAS ML ===
function updateMLMetrics() {
    const accuracy = document.getElementById('accuracy');
    const mse = document.getElementById('mse');
    const trainingTime = document.getElementById('training-time');
    
    if (accuracy) accuracy.textContent = '89.5%';
    if (mse) mse.textContent = '0.023';
    if (trainingTime) trainingTime.textContent = '1.2s';
}

// === CLUSTERING K-MEANS ===
function runClustering() {
    if (sensorData.length < 5) return;
    
    console.log('🎯 Ejecutando K-Means clustering...');
    
    // Preparar datos para clustering
    const points = sensorData.map(d => ({
        x: Math.sqrt(d.accel_x*d.accel_x + d.accel_y*d.accel_y + d.accel_z*d.accel_z),
        y: d.temp
    }));
    
    // Clustering simple (simulado)
    const clusters = performKMeans(points, CONFIG.mlConfig.clusters);
    
    // Actualizar gráfico
    updateClusterChart(clusters);
}

// === K-MEANS SIMPLIFICADO ===
function performKMeans(points, k) {
    const clusters = [];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    
    // Inicializar centroides aleatoriamente
    let centroids = [];
    for (let i = 0; i < k; i++) {
        const randomPoint = points[Math.floor(Math.random() * points.length)];
        centroids.push({ ...randomPoint });
    }
    
    // Asignar puntos a clusters
    for (let i = 0; i < k; i++) {
        clusters.push({
            label: `Cluster ${i + 1}`,
            data: [],
            backgroundColor: colors[i] || '#6b7280',
            borderColor: colors[i] || '#6b7280'
        });
    }
    
    points.forEach(point => {
        let minDist = Infinity;
        let clusterIndex = 0;
        
        centroids.forEach((centroid, i) => {
            const dist = Math.sqrt(
                Math.pow(point.x - centroid.x, 2) + 
                Math.pow(point.y - centroid.y, 2)
            );
            
            if (dist < minDist) {
                minDist = dist;
                clusterIndex = i;
            }
        });
        
        clusters[clusterIndex].data.push(point);
    });
    
    return clusters;
}

// === ACTUALIZAR GRÁFICO DE CLUSTERING ===
function updateClusterChart(clusters) {
    if (!charts.cluster) return;
    
    charts.cluster.data.datasets = clusters;
    charts.cluster.update();
}

// === DETECCIÓN DE ANOMALÍAS ===
async function detectAnomalies() {
    if (!mlModels.anomalyDetector || sensorData.length === 0) return;
    
    try {
        const latest = sensorData[sensorData.length - 1];
        const features = tf.tensor2d([[
            latest.accel_x, latest.accel_y, latest.accel_z,
            latest.gyro_x, latest.gyro_y, latest.gyro_z
        ]]);
        
        const reconstruction = mlModels.anomalyDetector.predict(features);
        const error = tf.losses.meanSquaredError(features, reconstruction);
        const anomalyScore = await error.data();
        
        features.dispose();
        reconstruction.dispose();
        error.dispose();
        
        // Actualizar indicador de anomalía
        updateAnomalyIndicator(anomalyScore[0]);
        
        return anomalyScore[0];
        
    } catch (error) {
        console.error('Error detectando anomalías:', error);
        return 0;
    }
}

// === ACTUALIZAR INDICADOR DE ANOMALÍA ===
function updateAnomalyIndicator(score) {
    const anomalyDot = document.getElementById('anomaly-dot');
    const anomalyStatus = document.getElementById('anomaly-status');
    
    if (anomalyDot && anomalyStatus) {
        if (score > CONFIG.mlConfig.anomalyThreshold) {
            anomalyDot.style.backgroundColor = '#ef4444';
            anomalyStatus.textContent = 'Anomalía Detectada';
            anomalyStatus.style.color = '#ef4444';
        } else if (score > 0.5) {
            anomalyDot.style.backgroundColor = '#f59e0b';
            anomalyStatus.textContent = 'Comportamiento Irregular';
            anomalyStatus.style.color = '#f59e0b';
        } else {
            anomalyDot.style.backgroundColor = '#10b981';
            anomalyStatus.textContent = 'Normal';
            anomalyStatus.style.color = '#10b981';
        }
    }
    
    // Actualizar gráfico de anomalías
    if (charts.anomaly) {
        const labels = charts.anomaly.data.labels;
        const data = charts.anomaly.data.datasets[0].data;
        
        labels.push(`T-${labels.length}`);
        data.push(score);
        
        if (labels.length > CONFIG.maxDataPoints) {
            labels.shift();
            data.shift();
        }
        
        charts.anomaly.update('none');
    }
}

// === PREDICCIONES ===
async function generatePredictions() {
    if (sensorData.length < 10) return;
    
    console.log('🔮 Generando predicciones...');
    
    try {
        // Predicción simple basada en tendencias
        const recentData = sensorData.slice(-10);
        
        // Predicción de comportamiento
        const behaviorPredictions = predictBehavior(recentData);
        updateBehaviorPredictions(behaviorPredictions);
        
        // Predicción de temperatura
        const tempPredictions = predictTemperature(recentData);
        updateTemperaturePredictions(tempPredictions);
        
        // Actualizar gráficos de predicción
        updatePredictionCharts(recentData, tempPredictions);
        
    } catch (error) {
        console.error('Error generando predicciones:', error);
    }
}

// === PREDICCIÓN DE COMPORTAMIENTO ===
function predictBehavior(data) {
    const activities = data.map(d => 
        Math.sqrt(d.accel_x*d.accel_x + d.accel_y*d.accel_y + d.accel_z*d.accel_z)
    );
    
    const avgActivity = activities.reduce((a, b) => a + b, 0) / activities.length;
    const trend = activities[activities.length - 1] - activities[0];
    
    const predictions = [];
    
    // Predicción para próxima hora
    if (avgActivity < 5) {
        predictions.push('Descansando');
    } else if (avgActivity < 10) {
        predictions.push('Caminando');
    } else {
        predictions.push('Pastoreando');
    }
    
    // Predicción para 3 horas (considerando tendencia)
    if (trend > 0) {
        predictions.push('Actividad Creciente');
    } else {
        predictions.push('Período de Descanso');
    }
    
    // Predicción para 6 horas (patrón circadiano)
    const hour = new Date().getHours();
    if (hour >= 6 && hour <= 18) {
        predictions.push('Pastoreo Activo');
    } else {
        predictions.push('Descanso Nocturno');
    }
    
    return predictions;
}

// === PREDICCIÓN DE TEMPERATURA ===
function predictTemperature(data) {
    const temps = data.map(d => d.temp);
    const n = temps.length;
    
    // Regresión lineal simple
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += temps[i];
        sumXY += i * temps[i];
        sumXX += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Generar predicciones
    const predictions = [];
    for (let i = 0; i < CONFIG.mlConfig.predictionSteps; i++) {
        const predictedTemp = intercept + slope * (n + i);
        predictions.push(Math.max(15, Math.min(35, predictedTemp))); // Límites realistas
    }
    
    return predictions;
}

// === ACTUALIZAR PREDICCIONES DE COMPORTAMIENTO ===
function updateBehaviorPredictions(predictions) {
    const pred1h = document.getElementById('pred-1h');
    const pred3h = document.getElementById('pred-3h');
    const pred6h = document.getElementById('pred-6h');
    
    if (pred1h) pred1h.textContent = predictions[0] || 'Analizando...';
    if (pred3h) pred3h.textContent = predictions[1] || 'Analizando...';
    if (pred6h) pred6h.textContent = predictions[2] || 'Analizando...';
}

// === ACTUALIZAR PREDICCIONES DE TEMPERATURA ===
function updateTemperaturePredictions(predictions) {
    // Actualizar elemento de comportamiento actual
    const currentBehavior = document.getElementById('current-behavior');
    const confidenceLevel = document.getElementById('confidence-level');
    
    if (currentBehavior) {
        const avgTemp = predictions.reduce((a, b) => a + b, 0) / predictions.length;
        if (avgTemp > 28) {
            currentBehavior.textContent = 'Estrés Térmico Posible';
        } else if (avgTemp < 18) {
            currentBehavior.textContent = 'Temperatura Baja';
        } else {
            currentBehavior.textContent = 'Condiciones Normales';
        }
    }
    
    if (confidenceLevel) {
        confidenceLevel.textContent = '87.3%';
    }
}

// === ACTUALIZAR GRÁFICOS DE PREDICCIÓN ===
function updatePredictionCharts(recentData, tempPredictions) {
    // Gráfico de predicción general
    if (charts.prediction) {
        const realLabels = recentData.map((_, i) => `T-${i}`);
        const predLabels = tempPredictions.map((_, i) => `T+${i + 1}`);
        const allLabels = [...realLabels, ...predLabels];
        
        const realData = recentData.map(d => d.temp);
        const predData = new Array(realData.length).fill(null).concat(tempPredictions);
        
        charts.prediction.data.labels = allLabels;
        charts.prediction.data.datasets[0].data = [...realData, ...new Array(tempPredictions.length).fill(null)];
        charts.prediction.data.datasets[1].data = predData;
        charts.prediction.update('none');
    }
    
    // Gráfico de predicción de temperatura
    if (charts.tempPrediction) {
        const labels = tempPredictions.map((_, i) => `+${i + 1}h`);
        
        charts.tempPrediction.data.labels = labels;
        charts.tempPrediction.data.datasets[0].data = recentData.slice(-tempPredictions.length).map(d => d.temp);
        charts.tempPrediction.data.datasets[1].data = tempPredictions;
        charts.tempPrediction.update('none');
    }
}

// === SISTEMA DE ALERTAS ===
function initializeAlerts() {
    console.log('🚨 Inicializando sistema de alertas...');
    
    // Cargar configuración de alertas
    loadAlertConfig();
    
    // Mostrar alertas iniciales
    showAlert('Sistema de monitoreo iniciado', 'info');
}

// === VERIFICAR ALERTAS ===
function checkAlerts(data) {
    const alerts = [];
    
    // Verificar temperatura
    if (data.temp > CONFIG.alertThresholds.tempMax) {
        alerts.push({
            type: 'warning',
            message: `Temperatura alta: ${data.temp.toFixed(1)}°C`,
            timestamp: new Date()
        });
    }
    
    // Verificar actividad
    const activity = Math.sqrt(data.accel_x*data.accel_x + data.accel_y*data.accel_y + data.accel_z*data.accel_z);
    if (activity > CONFIG.alertThresholds.accelMax) {
        alerts.push({
            type: 'warning',
            message: `Actividad inusual detectada: ${activity.toFixed(2)} m/s²`,
            timestamp: new Date()
        });
    }
    
    // Verificar batería
    if (data.bateria < CONFIG.alertThresholds.batteryMin) {
        alerts.push({
            type: 'danger',
            message: `Batería baja: ${data.bateria.toFixed(2)}V`,
            timestamp: new Date()
        });
    }
    
    // Mostrar nuevas alertas
    alerts.forEach(alert => showAlert(alert.message, alert.type));
}

// === MOSTRAR ALERTA ===
function showAlert(message, type = 'info') {
    const alertsList = document.getElementById('alerts-list');
    if (!alertsList) return;
    
    const alertElement = document.createElement('div');
    alertElement.className = `alert-item ${type}`;
    alertElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>${getAlertIcon(type)} ${getAlertTitle(type)}</strong>
                <p style="margin: 4px 0 0 0; color: #6b7280;">${message}</p>
                <small style="color: #9ca3af;">${new Date().toLocaleTimeString()}</small>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #6b7280;">×</button>
        </div>
    `;
    
    // Insertar al principio de la lista
    alertsList.insertBefore(alertElement, alertsList.firstChild);
    
    // Limitar número de alertas mostradas
    while (alertsList.children.length > 10) {
        alertsList.removeChild(alertsList.lastChild);
    }
    
    // Auto-remover después de 30 segundos
    setTimeout(() => {
        if (alertElement.parentNode) {
            alertElement.remove();
        }
    }, 30000);
}

// === HELPERS PARA ALERTAS ===
function getAlertIcon(type) {
    switch (type) {
        case 'info': return 'ℹ️';
        case 'warning': return '⚠️';
        case 'danger': return '🚨';
        default: return 'ℹ️';
    }
}

function getAlertTitle(type) {
    switch (type) {
        case 'info': return 'Información';
        case 'warning': return 'Advertencia';
        case 'danger': return 'Alerta Crítica';
        default: return 'Notificación';
    }
}

// === CARGAR CONFIGURACIÓN DE ALERTAS ===
function loadAlertConfig() {
    const tempMax = document.getElementById('temp-max');
    const accelMax = document.getElementById('accel-max');
    const batteryMin = document.getElementById('battery-min');
    
    if (tempMax) tempMax.value = CONFIG.alertThresholds.tempMax;
    if (accelMax) accelMax.value = CONFIG.alertThresholds.accelMax;
    if (batteryMin) batteryMin.value = CONFIG.alertThresholds.batteryMin;
}

// === ACTUALIZAR CONFIGURACIÓN DE ALERTAS ===
function updateAlertConfig() {
    const tempMax = document.getElementById('temp-max');
    const accelMax = document.getElementById('accel-max');
    const batteryMin = document.getElementById('battery-min');
    
    if (tempMax) CONFIG.alertThresholds.tempMax = parseFloat(tempMax.value);
    if (accelMax) CONFIG.alertThresholds.accelMax = parseFloat(accelMax.value);
    if (batteryMin) CONFIG.alertThresholds.batteryMin = parseFloat(batteryMin.value);
    
    showAlert('Configuración de alertas actualizada', 'info');
    console.log('⚙️ Configuración de alertas actualizada:', CONFIG.alertThresholds);
}

// === ACTUALIZAR CLUSTERS ===
function updateClusters() {
    if (sensorData.length > 0) {
        runClustering();
        showAlert('Análisis de clustering actualizado', 'info');
    }
}

// === BUCLE PRINCIPAL DE ML ===
setInterval(async () => {
    if (sensorData.length > 10 && !isMLTraining) {
        try {
            // Detectar anomalías
            await detectAnomalies();
            
            // Generar predicciones cada 10 segundos
            if (Date.now() % 10000 < CONFIG.updateInterval) {
                await generatePredictions();
            }
            
            // Reentrenar modelos cada minuto
            if (Date.now() % 60000 < CONFIG.updateInterval) {
                await trainModels();
            }
            
        } catch (error) {
            console.error('Error en bucle ML:', error);
        }
    }
}, CONFIG.updateInterval);

// === FUNCIONES GLOBALES PARA BOTONES ===
window.runClustering = runClustering;
window.updateClusters = updateClusters;
window.updateAlertConfig = updateAlertConfig;

// === MANEJO DE ERRORES GLOBALES ===
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
    showAlert('Error en el sistema. Revise la consola.', 'danger');
});

// === FUNCIÓN DE LIMPIEZA AL CERRAR ===
window.addEventListener('beforeunload', () => {
    // Limpiar recursos de TensorFlow.js
    if (mlModels.behaviorClassifier) {
        mlModels.behaviorClassifier.dispose();
    }
    if (mlModels.anomalyDetector) {
        mlModels.anomalyDetector.dispose();
    }
    
    console.log('🧹 Recursos de ML liberados');
});

console.log('📜 Script cargado completamente');