import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { getWeatherByLocation, DEFAULT_WEATHER_LOCATION } from '../utils/weatherApi';

/**
 * 설정 기반 날씨 정보 Hook (기본: 서울시)
 */
export function useWeather() {
    const { settings } = useSettings();
    const [weather, setWeather] = useState({
        temperature: 0,
        humidity: 0,
        description: '',
        icon: '',
        feelsLike: 0,
        windSpeed: 0,
        windDirection: 0,
        pressure: 0,
        cloudCover: 0,
        precipitation: 0,
        pm25: 0,
        pm10: 0,
        usAqi: 0,
        euAqi: 0,
        ozone: 0,
        no2: 0,
        updatedAt: null,
        city: DEFAULT_WEATHER_LOCATION.city,
        loading: true
    });

    useEffect(() => {
        async function fetchWeather() {
            const result = await getWeatherByLocation({
                city: settings.weatherCity,
                lat: settings.weatherLat,
                lon: settings.weatherLon
            });

            if (result.success || result.data) {
                setWeather({
                    ...result.data,
                    loading: false
                });
            }
        }

        fetchWeather();
        // 10분마다 날씨 업데이트
        const interval = setInterval(fetchWeather, 600000);
        return () => clearInterval(interval);
    }, [settings.weatherCity, settings.weatherLat, settings.weatherLon]);

    return weather;
}
