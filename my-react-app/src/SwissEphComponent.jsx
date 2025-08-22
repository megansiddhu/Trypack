import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import SwissEph from 'swisseph-wasm';
import { ASTRO_DATA } from './astrodata.js';

// Memoized constants
const PLANETS = ASTRO_DATA.PLANETS.filter(p => !['Uranus', 'Neptune', 'Pluto'].includes(p));
const RASHIS = ASTRO_DATA.ZODIAC_SIGNS;
const TAMIL_RASHIS = ASTRO_DATA.TAMIL_ZODIAC;

const AYANAMSHA_OPTIONS = [
  { value: 'SE_SIDM_LAHIRI', label: 'Lahiri' },
  { value: 'SE_SIDM_RAMAN', label: 'Raman' },
  { value: 'SE_SIDM_PUSHYA_PAKSHA', label: 'Pushya Paksha' },
  { value: 'SE_SIDM_KRISHNAMURTI', label: 'Krishnamurti' },
  { value: 'SE_SIDM_TRUE_CHITRA', label: 'True Chitra' }
];

const SOUTH_INDIAN_LAYOUT = [
  { gridPos: "row-start-1 col-start-1", rashiIndex: 11 },
  { gridPos: "row-start-1 col-start-2", rashiIndex: 0 },
  { gridPos: "row-start-1 col-start-3", rashiIndex: 1 },
  { gridPos: "row-start-1 col-start-4", rashiIndex: 2 },
  { gridPos: "row-start-2 col-start-1", rashiIndex: 10 },
  { gridPos: "row-start-2 col-start-4", rashiIndex: 3 },
  { gridPos: "row-start-3 col-start-1", rashiIndex: 9 },
  { gridPos: "row-start-3 col-start-4", rashiIndex: 4 },
  { gridPos: "row-start-4 col-start-1", rashiIndex: 8 },
  { gridPos: "row-start-4 col-start-2", rashiIndex: 7 },
  { gridPos: "row-start-4 col-start-3", rashiIndex: 6 },
  { gridPos: "row-start-4 col-start-4", rashiIndex: 5 }
];

const PLANET_SYMBOLS = {
  Moon: '🌙', Sun: '☀️', Mars: '♂️', Mercury: '☿️',
  Jupiter: '♃', Venus: '♀️', Saturn: '♄', Rahu: '☊', Ketu: '☋'
};

// Memoized helper functions
const getRashi = (longitude) => {
  const normalizedLong = ((longitude % 360) + 360) % 360;
  const rashiIndex = Math.floor(normalizedLong / 30);
  const degree = normalizedLong % 30;
  
  return {
    rashi: RASHIS[rashiIndex],
    tamilRashi: TAMIL_RASHIS[rashiIndex],
    degree: Math.floor(degree),
    minute: Math.floor((degree % 1) * 60),
    rashiIndex
  };
};

const formatDegree = (degree) => `${Math.floor(degree)}° ${Math.floor((degree % 1) * 60)}'`;

const getPlanetaryStatusSymbol = (status) => {
  const symbols = {
    Exalted: <span className="text-green-600">▲</span>,
    Debilitated: <span className="text-blue-600">▼</span>,
    Mooltrikona: <span className="text-purple-600">☗</span>,
    Mooltrikona_Exalted: <><span className="text-purple-600">☗</span><span className="text-green-600">▲</span></>,
    Friendly: <span className="text-green-400">😃</span>,
    Enemy: <span className="text-red-500">👿</span>,
    Neutral: <span className="text-gray-500">😐</span>
  };
  return symbols[status] || '';
};

const getPlanetaryStatusSymbols = (planet, rashi, details) => (
  <>
    {getPlanetaryStatusSymbol(ASTRO_DATA.ZODIAC_STATUS[rashi]?.[planet])}
    {details.isRetro === 'true' && <span className="text-orange-500">↺</span>}
  </>
);

// Memoized chart box component with mobile-responsive sizing
const ChartBox = memo(({ index, ascendantSignIndex, chartData, isTransit, selectedPlanet, isAspected }) => {
  const sign = RASHIS[index];
  const tamilName = TAMIL_RASHIS[index];
  const planets = Object.entries(chartData?.planets || {}).filter(([, details]) => details.rashiIndex === index);
  const houseNumber = ((index - ascendantSignIndex + 12) % 12) + 1;
  const isAscendant = houseNumber === 1 && !isTransit;

  return (
    <div 
      className={`border border-red-600 text-xs bg-white flex flex-col ${
        isAspected ? 'bg-yellow-50 border-yellow-400' : ''
      } p-1 sm:p-2`}
      style={{ minHeight: 'fit-content' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-1 sm:mb-2">
        <div className="flex items-center gap-1">
          <span className={`text-xs sm:text-sm font-bold ${isAscendant ? 'text-red-600' : 'text-gray-700'}`}>
            {houseNumber}
          </span>
          {[1, 4, 7, 10].includes(houseNumber) && <span className="text-blue-600 text-xs sm:text-sm">☐</span>}
          {[1, 5, 9].includes(houseNumber) && <span className="text-green-600 text-xs sm:text-sm">△</span>}
        </div>
        <div className="text-[6px] sm:text-[8px] text-gray-500 text-right leading-tight max-w-[40px] sm:max-w-[60px]">
          {ASTRO_DATA.HOUSE_DESCRIPTIONS?.[houseNumber]?.split(' - ')[0] || ''}
        </div>
      </div>
      
      {/* Sign names */}
      <div className="mb-1 sm:mb-2">
        <div className="text-[10px] sm:text-xs font-bold text-gray-800 leading-tight">{sign}</div>
        <div className="text-[8px] sm:text-[10px] text-gray-600 leading-tight">{tamilName}</div>
      </div>
      
      {/* Planets section - Mobile optimized */}
      <div className="mb-1 sm:mb-2 flex-grow">
        {planets.length > 0 ? (
          <div className="space-y-1 sm:space-y-2">
            {planets.map(([planet, details]) => (
              <div key={planet} className="bg-blue-50 p-1 sm:p-2 rounded border border-blue-200">
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <span className="text-blue-800 font-medium text-[10px] sm:text-xs leading-tight flex items-center gap-1">
                    <span className="text-yellow-500 text-xs sm:text-sm">{PLANET_SYMBOLS[planet]}</span>
                    <span className="hidden sm:inline">{planet}</span>
                    <span className="sm:hidden">{planet.substring(0, 3)}</span>
                  </span>
                  <span className="text-[10px] sm:text-xs flex items-center gap-1">
                    {getPlanetaryStatusSymbols(planet, sign, details)}
                  </span>
                </div>
                <div className="text-gray-600 text-[8px] sm:text-[10px] leading-tight font-medium">
                  {formatDegree(details.degree + details.minute/60)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 text-[8px] sm:text-[10px] py-2 sm:py-4">
            No planets
          </div>
        )}
      </div>
      
      {/* Relations section - Simplified for mobile */}
      <div className="pt-1 sm:pt-2 border-t border-gray-200">
        <div className="text-[6px] sm:text-[8px] text-gray-600">
          <div className="font-semibold mb-1 hidden sm:block">Relations:</div>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-0.5 sm:gap-1">
            {Object.entries(ASTRO_DATA.ZODIAC_STATUS[sign] || {}).map(([planet, status]) => (
              <span key={planet} className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 px-0.5 sm:px-1 py-0.5 rounded text-[6px] sm:text-[7px]">
                <span className="whitespace-nowrap">{planet.substring(0, 2)}:</span>
                {getPlanetaryStatusSymbol(status)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

ChartBox.displayName = 'ChartBox';

const SwissEphComponent = () => {
  const [swe, setSwe] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [birthChart, setBirthChart] = useState(null);
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [transitChart, setTransitChart] = useState(null);
  const [birthData, setBirthData] = useState({
    year: 2000, month: 7, day: 1, hour: 7, minute: 12,
    timezone: 5.5, latitude: 9.9252, longitude: 78.1198
  });
  const [selectedAyanamsha, setSelectedAyanamsha] = useState('SE_SIDM_LAHIRI');

  const isHouseAspected = useCallback((houseIndex, planetDetails) => {
    if (!selectedPlanet || !planetDetails) return false;
    const planetHouse = planetDetails.rashiIndex;
    const aspects = ASTRO_DATA.ASPECTS[selectedPlanet] || [];
    return aspects.some(aspect => (planetHouse + aspect - 1) % 12 === houseIndex);
  }, [selectedPlanet]);

  // Initialize SwissEph
  useEffect(() => {
    let mounted = true;
    const initSwissEph = async () => {
      try {
        setLoading(true);
        setError('');
        const swissEph = new SwissEph();
        await swissEph.initSwissEph();
        if (mounted) {
          setSwe(swissEph);
          setIsInitialized(true);
        }
      } catch (err) {
        if (mounted) setError(`Failed to initialize: ${err.message}`);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    initSwissEph();
    return () => { mounted = false; };
  }, []);

  const calculateChart = useCallback(async (isTransit = false) => {
    if (!isInitialized || !swe) return;

    try {
      setLoading(true);
      setError('');

      const date = isTransit ? new Date() : birthData;
      const jd = isTransit 
        ? swe.julday(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours() + date.getMinutes() / 60)
        : swe.julday(date.year, date.month, date.day, date.hour + date.minute / 60 - date.timezone);

      swe.set_sid_mode(swe[selectedAyanamsha], 0, 0);

      const chart = { planets: {}, houses: {}, ascendant: null };

      // Calculate planetary positions
      for (const planet of PLANETS) {
        try {
          const planetId = planet === 'Rahu' || planet === 'Ketu' ? swe.SE_TRUE_NODE : swe[`SE_${planet.toUpperCase()}`];
          const pos = swe.calc_ut(jd, planetId, swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL);
          let longitude = planet === 'Ketu' ? (pos[0] + 180) % 360 : pos[0];
          
          chart.planets[planet] = {
            longitude,
            ...getRashi(longitude),
            isRetro: pos[3] < 0 ? 'true' : 'false'
          };
        } catch (err) {
          console.error(`Error calculating ${planet}:`, err);
        }
      }

      // Calculate houses for birth chart
      if (!isTransit) {
        try {
          const houses = swe.houses(jd, birthData.latitude, birthData.longitude, 'P');
          const ayanamsha_value = swe.get_ayanamsa(jd);
          const asc_sidereal = (houses.cusps[1] - ayanamsha_value + 360) % 360;
          
          chart.ascendant = { longitude: asc_sidereal, ...getRashi(asc_sidereal) };

          for (let i = 1; i <= 12; i++) {
            const house_sidereal = (houses.cusps[i] - ayanamsha_value + 360) % 360;
            chart.houses[`House${i}`] = { longitude: house_sidereal, ...getRashi(house_sidereal) };
          }
        } catch (err) {
          console.error('Error calculating houses:', err);
        }
      }

      isTransit ? setTransitChart(chart) : setBirthChart(chart);
    } catch (err) {
      setError(`Error calculating chart: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [isInitialized, swe, birthData, selectedAyanamsha]);

  const calculateBirthChart = useCallback(() => calculateChart(false), [calculateChart]);
  const calculateTransitChart = useCallback(() => calculateChart(true), [calculateChart]);

  const handleInputChange = useCallback((field, value) => {
    setBirthData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  }, []);

  const handlePlanetSelect = useCallback((planet) => {
    setSelectedPlanet(planet === '' ? null : planet);
  }, []);

  // Memoized chart renderer with mobile-responsive design
  const SouthIndianChart = memo(({ chartData, isTransit }) => {
    const ascendantSignIndex = useMemo(() => 
      isTransit 
        ? (birthChart?.planets?.Moon?.rashiIndex || 0)
        : (chartData.ascendant?.rashiIndex || 0), 
      [isTransit, birthChart, chartData]
    );

    return (
      <div className="bg-white rounded-lg p-2 sm:p-4 shadow-lg w-full">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 sm:mb-6 gap-2 sm:gap-4">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            {isTransit ? 'Transit Chart (Moon Chart)' : 'Birth Chart'}
          </h3>
          <select 
            value={selectedPlanet || ''} 
            onChange={(e) => handlePlanetSelect(e.target.value)}
            className="w-full lg:w-auto px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Planet Aspects</option>
            {PLANETS.map(planet => (
              <option key={planet} value={planet}>{planet} Aspects</option>
            ))}
          </select>
        </div>
        
        <div className="w-full overflow-x-auto">
          <div className="w-full" style={{ minWidth: '300px' }}>
            <div className="grid grid-cols-4 gap-1 sm:gap-2 w-full border-2 border-gray-800 p-1 sm:p-2" 
                 style={{ gridTemplateRows: 'auto auto auto auto' }}>
              {SOUTH_INDIAN_LAYOUT.map((layout, index) => (
                <div key={index} className={layout.gridPos}>
                  <ChartBox 
                    index={layout.rashiIndex}
                    ascendantSignIndex={ascendantSignIndex}
                    chartData={chartData}
                    isTransit={isTransit}
                    selectedPlanet={selectedPlanet}
                    isAspected={selectedPlanet && isHouseAspected(layout.rashiIndex, chartData?.planets[selectedPlanet])}
                  />
                </div>
              ))}
              
              {/* Center box - Mobile optimized */}
              <div className="row-start-2 col-start-2 row-span-2 col-span-2 border-2 border-gray-800 bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center items-center p-2 sm:p-6">
                <h4 className="text-lg sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-4 text-center">
                  {isTransit ? '🌙 Transit' : '⭐ Birth Chart'}
                </h4>
                {!isTransit && chartData.ascendant && (
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Ascendant</p>
                    <p className="text-lg sm:text-xl font-bold text-blue-800">{chartData.ascendant.rashi}</p>
                    <p className="text-xs sm:text-sm text-gray-500">{formatDegree(chartData.ascendant.degree + chartData.ascendant.minute/60)}</p>
                  </div>
                )}
                {isTransit && (
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Current Transits</p>
                    <p className="text-xs sm:text-sm text-gray-500">{new Date().toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  });

  SouthIndianChart.displayName = 'SouthIndianChart';

  return (
    <div className="w-full mx-auto p-2 sm:p-4 font-sans bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="text-center mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 sm:mb-4">Vedic Astrology Chart Calculator</h1>
        <div className="flex items-center justify-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isInitialized ? 'bg-green-500' : loading ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
          <span className="text-xs sm:text-sm text-gray-600">{loading ? 'Loading...' : isInitialized ? 'Ready' : 'Error'}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-4 sm:mb-6 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* Form Section - Mobile optimized */}
      <div className="bg-white rounded-lg p-3 sm:p-6 mb-4 sm:mb-8 shadow-lg">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6">Birth Information</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Date */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Date</label>
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              {[
                { field: 'year', placeholder: 'YYYY', label: 'Year' },
                { field: 'month', placeholder: 'MM', label: 'Month', min: 1, max: 12 },
                { field: 'day', placeholder: 'DD', label: 'Day', min: 1, max: 31 }
              ].map(({ field, placeholder, label, min, max }) => (
                <div key={field}>
                  <input
                    type="number"
                    placeholder={placeholder}
                    min={min}
                    max={max}
                    value={birthData[field]}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    className="w-full px-1.5 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 text-center">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Time</label>
            <div className="grid grid-cols-2 gap-1 sm:gap-2">
              {[
                { field: 'hour', placeholder: 'HH', label: 'Hour (24h)', max: 23 },
                { field: 'minute', placeholder: 'MM', label: 'Minute', max: 59 }
              ].map(({ field, placeholder, label, max }) => (
                <div key={field}>
                  <input
                    type="number"
                    placeholder={placeholder}
                    min="0"
                    max={max}
                    value={birthData[field]}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    className="w-full px-1.5 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 text-center">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Location & Timezone</label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { field: 'latitude', placeholder: 'Lat', step: '0.0001' },
                { field: 'longitude', placeholder: 'Lng', step: '0.0001' },
                { field: 'timezone', placeholder: 'GMT', step: '0.5' }
              ].map(({ field, placeholder, step }) => (
                <input
                  key={field}
                  type="number"
                  step={step}
                  placeholder={placeholder}
                  value={birthData[field]}
                  onChange={(e) => handleInputChange(field, e.target.value)}
                  className="w-full px-1.5 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Ayanamsha</label>
          <select 
            value={selectedAyanamsha} 
            onChange={(e) => setSelectedAyanamsha(e.target.value)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {AYANAMSHA_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <button 
            onClick={calculateBirthChart}
            disabled={loading || !isInitialized}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            {loading ? 'Calculating...' : 'Calculate Birth Chart'}
          </button>
          
          <button 
            onClick={calculateTransitChart}
            disabled={loading || !isInitialized}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            Calculate Transit Chart
          </button>
        </div>
      </div>

      {/* Charts Section */}
      <div className="space-y-4 sm:space-y-8">
        {birthChart && <SouthIndianChart chartData={birthChart} isTransit={false} />}
        {transitChart && <SouthIndianChart chartData={transitChart} isTransit={true} />}
      </div>
    </div>
  );
};

export default SwissEphComponent;