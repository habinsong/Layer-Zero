// Open-Meteo API 클라이언트 (무료, API 키 불필요, 안정적)
// 설정 기반 위치(기본: 서울시)로 날씨 정보를 가져옵니다.

export const DEFAULT_WEATHER_LOCATION = {
    city: '서울시',
    lat: 37.5665,
    lon: 126.9780
};

/**
 * 지정 위치 현재 날씨 가져오기
 */
export async function getWeatherByLocation(location = {}) {
    const city = String(location.city || DEFAULT_WEATHER_LOCATION.city).trim() || DEFAULT_WEATHER_LOCATION.city;
    const lat = Number.isFinite(Number(location.lat)) ? Number(location.lat) : DEFAULT_WEATHER_LOCATION.lat;
    const lon = Number.isFinite(Number(location.lon)) ? Number(location.lon) : DEFAULT_WEATHER_LOCATION.lon;

    try {
        // Open-Meteo API 사용 (무료, API 키 불필요)
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,precipitation&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,precipitation&timezone=Asia/Seoul`;
        const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,us_aqi,european_aqi,ozone,nitrogen_dioxide&timezone=Asia/Seoul`;

        const [weatherRes, airRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(airUrl)
        ]);
        if (!weatherRes.ok) {
            throw new Error(`Weather API error! status: ${weatherRes.status}`);
        }

        const weatherData = await weatherRes.json();
        const airData = airRes.ok ? await airRes.json() : {};
        const current = weatherData.current || {};
        const hourly = weatherData.hourly || {};
        const airCurrent = airData.current || {};
        const airHourly = airData.hourly || {};

        const pickNumber = (objNow, objHourly, key, fallback = 0) => {
            const nowVal = objNow?.[key];
            if (Number.isFinite(Number(nowVal))) return Number(nowVal);
            const series = objHourly?.[key];
            if (Array.isArray(series) && series.length > 0) {
                const lastVal = series[series.length - 1];
                if (Number.isFinite(Number(lastVal))) return Number(lastVal);
            }
            return fallback;
        };

        // WMO Weather interpretation codes를 한글로 변환
        const getWeatherDescription = (code) => {
            const weatherCodes = {
                0: '맑음',
                1: '대체로 맑음',
                2: '구름 조금',
                3: '흐림',
                45: '안개',
                48: '안개',
                51: '가랑비',
                53: '보슬비',
                55: '비',
                61: '약한 비',
                63: '비',
                65: '강한 비',
                71: '약한 눈',
                73: '눈',
                75: '강한 눈',
                77: '진눈깨비',
                80: '소나기',
                81: '소나기',
                82: '강한 소나기',
                85: '눈',
                86: '강한 눈',
                95: '뇌우',
                96: '우박',
                99: '강한 우박'
            };
            return weatherCodes[code] || '알 수 없음';
        };

        return {
            success: true,
            data: {
                temperature: Math.round(pickNumber(current, hourly, 'temperature_2m', 0)),
                humidity: Math.round(pickNumber(current, hourly, 'relative_humidity_2m', 0)),
                description: getWeatherDescription(Number(current.weather_code ?? 0)),
                icon: Number(current.weather_code ?? 0),
                feelsLike: Math.round(pickNumber(current, hourly, 'apparent_temperature', 0)),
                windSpeed: pickNumber(current, hourly, 'wind_speed_10m', 0),
                windDirection: Math.round(pickNumber(current, hourly, 'wind_direction_10m', 0)),
                pressure: Math.round(pickNumber(current, hourly, 'pressure_msl', 0)),
                cloudCover: Math.round(pickNumber(current, hourly, 'cloud_cover', 0)),
                precipitation: pickNumber(current, hourly, 'precipitation', 0),
                pm25: Math.round(pickNumber(airCurrent, airHourly, 'pm2_5', 0) * 10) / 10,
                pm10: Math.round(pickNumber(airCurrent, airHourly, 'pm10', 0) * 10) / 10,
                usAqi: Math.round(pickNumber(airCurrent, airHourly, 'us_aqi', 0)),
                euAqi: Math.round(pickNumber(airCurrent, airHourly, 'european_aqi', 0)),
                ozone: Math.round(pickNumber(airCurrent, airHourly, 'ozone', 0)),
                no2: Math.round(pickNumber(airCurrent, airHourly, 'nitrogen_dioxide', 0)),
                updatedAt: current.time || null,
                city
            }
        };
    } catch (error) {
        console.error('Weather API Error:', error);

        // 겨울 날씨에 가까운 fallback 데이터 (2월 기준)
        return {
            success: false,
            error: error.message,
            data: {
                temperature: 2,
                humidity: 45,
                description: '맑음',
                icon: '01d',
                feelsLike: -1,
                windSpeed: 1.2,
                windDirection: 120,
                pressure: 1018,
                cloudCover: 15,
                precipitation: 0,
                pm25: 17.4,
                pm10: 28.1,
                usAqi: 44,
                euAqi: 28,
                ozone: 62,
                no2: 14,
                updatedAt: null,
                city
            }
        };
    }
}
