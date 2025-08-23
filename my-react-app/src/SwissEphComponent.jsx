import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import SwissEph from "swisseph-wasm";
import { ASTRO_DATA } from "./astrodata.js";

// Memoized constants
const PLANETS = ASTRO_DATA.PLANETS.filter(
  (p) => !["Uranus", "Neptune", "Pluto"].includes(p)
);
const RASHIS = ASTRO_DATA.ZODIAC_SIGNS;
const TAMIL_RASHIS = ASTRO_DATA.TAMIL_ZODIAC;

const AYANAMSHA_OPTIONS = [
  { value: "SE_SIDM_LAHIRI", label: "Lahiri" },
  { value: "SE_SIDM_RAMAN", label: "Raman" },
  { value: "SE_SIDM_PUSHYA_PAKSHA", label: "Pushya Paksha" },
  { value: "SE_SIDM_KRISHNAMURTI", label: "Krishnamurti" },
  { value: "SE_SIDM_TRUE_CHITRA", label: "True Chitra" },
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
  { gridPos: "row-start-4 col-start-4", rashiIndex: 5 },
];

// Form field configurations
const DATE_FIELDS = [
  { field: "year", placeholder: "YYYY", label: "Year" },
  { field: "month", placeholder: "MM", label: "Month", min: 1, max: 12 },
  { field: "day", placeholder: "DD", label: "Day", min: 1, max: 31 },
];

const TIME_FIELDS = [
  { field: "hour", placeholder: "HH", label: "Hour (24h)", max: 23 },
  { field: "minute", placeholder: "MM", label: "Minute", max: 59 },
];

const LOCATION_FIELDS = [
  { field: "latitude", placeholder: "Lat", step: "0.0001" },
  { field: "longitude", placeholder: "Lng", step: "0.0001" },
  { field: "timezone", placeholder: "GMT", step: "0.5" },
];

// Special house markers
const SPECIAL_HOUSES = {
  kendra: [1, 4, 7, 10],
  trikona: [1, 5, 9],
};

// Utility functions
const nakshatraWithPadaFromLongitude = (longitude) => {
  const nakshatras = ASTRO_DATA.NAKSHATRAS;
  const nakSpan = 360 / 27;
  const padaSpan = nakSpan / 4;
  let lon = ((longitude % 360) + 360) % 360;

  const nIdx = Math.floor(lon / nakSpan);
  const nakshatra = nakshatras[nIdx];
  const offsetInNak = lon - nIdx * nakSpan;
  const pada = Math.floor(offsetInNak / padaSpan) + 1;

  return {
    nakshatra,
    pada,
    longitude: lon,
    nakshatraIndex: nIdx + 1,
    degreeInNakshatra: offsetInNak,
    degreeInPada: offsetInNak % padaSpan,
  };
};

const calculateAge = (birthData) => {
  const now = new Date();
  const birth = new Date(birthData.year, birthData.month - 1, birthData.day);
  const ageInMilliseconds = now - birth;
  const years = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24 * 365.25));
  const months = Math.floor(
    (ageInMilliseconds % (1000 * 60 * 60 * 24 * 365.25)) /
      (1000 * 60 * 60 * 24 * 30.44)
  );
  return { years, months };
};

const getRashi = (longitude) => {
  const normalizedLong = ((longitude % 360) + 360) % 360;
  const rashiIndex = Math.floor(normalizedLong / 30);
  const degree = normalizedLong % 30;

  return {
    rashi: RASHIS[rashiIndex],
    tamilRashi: TAMIL_RASHIS[rashiIndex],
    degree: Math.floor(degree),
    minute: Math.floor((degree % 1) * 60),
    rashiIndex,
  };
};

const formatDegree = (degree) =>
  `${Math.floor(degree)}° ${Math.floor((degree % 1) * 60)}'`;

const getPlanetaryStatusSymbol = (status) => {
  const symbols = {
    Exalted: <span className="text-green-600">▲</span>,
    Debilitated: <span className="text-blue-600">▼</span>,
    Mooltrikona: <span className="text-purple-600">☗</span>,
    Mooltrikona_Exalted: (
      <>
        <span className="text-purple-600">☗</span>
        <span className="text-green-600">▲</span>
      </>
    ),
    Friendly: <span className="text-green-400">😃</span>,
    Enemy: <span className="text-red-500">👿</span>,
    Neutral: <span className="text-gray-500">😐</span>,
  };
  return symbols[status] || "";
};

// Input Field Component
const InputField = memo(
  ({ field, config, value, onChange, className = "" }) => (
    <div>
      <input
        type="number"
        placeholder={config.placeholder}
        min={config.min || "0"}
        max={config.max}
        step={config.step}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        className={`w-full px-1.5 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />
      {config.label && (
        <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 text-center">
          {config.label}
        </div>
      )}
    </div>
  )
);

InputField.displayName = "InputField";

// Nakshatra Display Component
const NakshatraDisplay = memo(({ chartData, isTransit, birthData }) => {
  const moonData = chartData?.planets?.Moon;
  if (!moonData) return null;

  const nakshatraInfo = nakshatraWithPadaFromLongitude(moonData.longitude);
  const age = !isTransit && birthData ? calculateAge(birthData) : null;

  const infoBoxes = [
    {
      key: "nakshatra",
      title: "Nakshatra & Pada",
      value: `${nakshatraInfo.nakshatra} - ${nakshatraInfo.pada}`,
      subtitle: `#${nakshatraInfo.nakshatraIndex}/27 - Pada ${nakshatraInfo.pada}/4`,
      className: "border-purple-200 flex-1 min-w-[200px]",
    },
  ];

  if (age) {
    infoBoxes.push({
      key: "age",
      title: "Current Age",
      value: `${age.years}y ${age.months}m`,
      subtitle: "Years & Months",
      className: "border-indigo-200 flex-shrink-0",
    });
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-100 border-2 border-purple-300 rounded-lg p-3 sm:p-4 mb-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base sm:text-lg font-bold text-purple-800 flex items-center gap-2">
          <span className="text-xl">🌙</span>
          Moon's Nakshatra {isTransit ? "(Current)" : "(Birth)"}
        </h3>
        <div className="text-xs sm:text-sm text-purple-600 bg-purple-200 px-2 py-1 rounded-full">
          {moonData.rashi}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {infoBoxes.map(({ key, title, value, subtitle, className }) => (
          <div
            key={key}
            className={`bg-white rounded-lg p-3 border ${className}`}
          >
            <div className="text-xs sm:text-sm text-gray-600 mb-1">{title}</div>
            <div className="text-lg sm:text-xl font-bold text-purple-800">
              {value}
            </div>
            <div className="text-xs text-gray-500">{subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

NakshatraDisplay.displayName = "NakshatraDisplay";

// Chart Box Component
const ChartBox = memo(
  ({
    index,
    ascendantSignIndex,
    chartData,
    isTransit,
    selectedPlanet,
    isAspected,
  }) => {
    const sign = RASHIS[index];
    const tamilName = TAMIL_RASHIS[index];
    const planets = Object.entries(chartData?.planets || {}).filter(
      ([, details]) => details.rashiIndex === index
    );
    const houseNumber = ((index - ascendantSignIndex + 12) % 12) + 1;
    const isAscendant = houseNumber === 1 && !isTransit;
    const hasPlanets = planets.length > 0;

    // Get planets present in this house
    const planetsInHouse = planets.map(([planet]) => planet);

    const renderHouseMarkers = () => (
      <div className="flex items-center gap-1">
        <span
          className={`text-xs sm:text-sm font-bold ${
            isAscendant ? "text-red-600" : "text-gray-700"
          }`}
        >
          {houseNumber}
        </span>
        {SPECIAL_HOUSES.kendra.includes(houseNumber) && (
          <span className="text-blue-600 text-xs sm:text-sm">☐</span>
        )}
        {SPECIAL_HOUSES.trikona.includes(houseNumber) && (
          <span className="text-green-600 text-xs sm:text-sm">△</span>
        )}
      </div>
    );

    const renderPlanets = () => (
      <div className="mb-1 sm:mb-2 flex-grow">
        {planets.length > 0 ? (
          <div className="space-y-1 sm:space-y-2">
            {planets.map(([planet, details]) => (
              <div key={planet}>
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <div className="flex items-center gap-1 text-blue-800 font-medium text-[10px] sm:text-xs leading-tight">
                    <span>{planet}</span>
                    <span className="text-gray-600 text-[8px] sm:text-[10px] font-medium">
                      {formatDegree(details.degree + details.minute / 60)}
                    </span>
                    <span>
                      {getPlanetaryStatusSymbol(
                        ASTRO_DATA.ZODIAC_STATUS[sign]?.[planet]
                      )}
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-xs flex items-center gap-1">
                    {details.isRetro === "true" && (
                      <span className="text-orange-500">↺</span>
                    )}
                  </div>
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
    );

    const renderRelations = () => {
      // Get remaining planetary relationships (excluding planets present in this house)
      const allPlanetaryRelations = ASTRO_DATA.ZODIAC_STATUS[sign] || {};
      const remainingRelations = Object.entries(allPlanetaryRelations).filter(
        ([planet]) => !planetsInHouse.includes(planet)
      );

      const relationTitle = hasPlanets
        ? "Remaining Relations:"
        : "All Relations:";

      return (
        <div
          className={`pt-2 sm:pt-3 pb-2 sm:pb-3 px-2 sm:px-3 border rounded-sm ${
            hasPlanets
              ? "bg-red-50 border-red-200"
              : "bg-blue-50 border-blue-200"
          }`}
        >
          <div className="text-[7px] sm:text-[9px] text-gray-700">
            <div className="font-semibold mb-1.5 sm:mb-2 hidden sm:block text-center">
              {relationTitle}
            </div>
            <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
              {remainingRelations.map(([planet, status]) => (
                <div
                  key={planet}
                  className="flex items-center justify-between gap-1 px-1 sm:px-1.5 py-1 bg-white bg-opacity-50 rounded-sm"
                >
                  <span className="whitespace-nowrap text-[7px] sm:text-[9px]">
                    {planet}:
                  </span>
                  <span className="flex-shrink-0">
                    {getPlanetaryStatusSymbol(status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div
        className={`border border-gray-300 text-xs flex flex-col ${
          isAspected ? "bg-yellow-50 border-yellow-400" : "bg-white"
        } p-1 sm:p-2`}
        style={{ minHeight: "180px" }} // Set consistent minimum height
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-1 sm:mb-2">
          {renderHouseMarkers()}
          <div className="text-[6px] sm:text-[8px] text-gray-500 text-right leading-tight max-w-[40px] sm:max-w-[60px]">
            {ASTRO_DATA.HOUSE_DESCRIPTIONS?.[houseNumber]?.split(" - ")[0] ||
              ""}
          </div>
        </div>

        {/* Sign names */}
        <div className="mb-1 sm:mb-2">
          <div className="text-[10px] sm:text-xs font-bold text-gray-800 leading-tight">
            {sign}
          </div>
          <div className="text-[8px] sm:text-[10px] text-gray-600 leading-tight">
            {tamilName}
          </div>
        </div>

        {renderPlanets()}
        {renderRelations()}
      </div>
    );
  }
);

ChartBox.displayName = "ChartBox";

// Form Section Component
const FormSection = memo(
  ({
    birthData,
    onInputChange,
    selectedAyanamsha,
    onAyanamshaChange,
    onCalculateBirth,
    onCalculateTransit,
    loading,
    isInitialized,
  }) => {
    const formSections = [
      {
        title: "Date",
        fields: DATE_FIELDS,
        gridClass: "grid-cols-3",
      },
      {
        title: "Time",
        fields: TIME_FIELDS,
        gridClass: "grid-cols-2",
      },
      {
        title: "Location & Timezone",
        fields: LOCATION_FIELDS,
        gridClass: "grid-cols-3",
      },
    ];

    const buttons = [
      {
        text: "Calculate Birth Chart",
        onClick: onCalculateBirth,
        className: "bg-blue-600 hover:bg-blue-700",
      },
      {
        text: "Calculate Transit Chart",
        onClick: onCalculateTransit,
        className: "bg-green-600 hover:bg-green-700",
      },
    ];

    return (
      <div className="bg-white rounded-lg p-3 sm:p-6 mb-4 sm:mb-8 shadow-lg">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6">
          Birth Information
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {formSections.map(({ title, fields, gridClass }) => (
            <div key={title}>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                {title}
              </label>
              <div className={`grid ${gridClass} gap-1 sm:gap-2`}>
                {fields.map((config) => (
                  <InputField
                    key={config.field}
                    field={config.field}
                    config={config}
                    value={birthData[config.field]}
                    onChange={onInputChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4 sm:mb-6">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Ayanamsha
          </label>
          <select
            value={selectedAyanamsha}
            onChange={(e) => onAyanamshaChange(e.target.value)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {AYANAMSHA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          {buttons.map(({ text, onClick, className }) => (
            <button
              key={text}
              onClick={onClick}
              disabled={loading || !isInitialized}
              className={`px-4 sm:px-6 py-2 sm:py-3 text-white rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base ${className}`}
            >
              {loading ? "Calculating..." : text}
            </button>
          ))}
        </div>
      </div>
    );
  }
);

FormSection.displayName = "FormSection";

// South Indian Chart Component
const SouthIndianChart = memo(
  ({
    chartData,
    isTransit,
    birthData,
    selectedPlanet,
    onPlanetSelect,
    isHouseAspected,
  }) => {
    const ascendantSignIndex = useMemo(
      () =>
        isTransit
          ? chartData?.planets?.Moon?.rashiIndex || 0
          : chartData.ascendant?.rashiIndex || 0,
      [isTransit, chartData]
    );

    const centerContent = isTransit ? (
      <div className="text-center">
        <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
          Current Transits
        </p>
        <p className="text-xs sm:text-sm text-gray-500">
          {new Date().toLocaleDateString()}
        </p>
      </div>
    ) : chartData.ascendant ? (
      <div className="text-center">
        <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
          Ascendant
        </p>
        <p className="text-lg sm:text-xl font-bold text-blue-800">
          {chartData.ascendant.rashi}
        </p>
        <p className="text-xs sm:text-sm text-gray-500">
          {formatDegree(
            chartData.ascendant.degree + chartData.ascendant.minute / 60
          )}
        </p>
      </div>
    ) : null;

    return (
      <div className="bg-white rounded-lg p-2 sm:p-4 shadow-lg w-full">
        <NakshatraDisplay
          chartData={chartData}
          isTransit={isTransit}
          birthData={birthData}
        />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 sm:mb-6 gap-2 sm:gap-4">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            {isTransit ? "Transit Chart (Moon Chart)" : "Birth Chart"}
          </h3>
          <select
            value={selectedPlanet || ""}
            onChange={(e) => onPlanetSelect(e.target.value)}
            className="w-full lg:w-auto px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Planet Aspects</option>
            {PLANETS.map((planet) => (
              <option key={planet} value={planet}>
                {planet} Aspects
              </option>
            ))}
          </select>
        </div>

        <div className="w-full overflow-x-auto">
          <div className="w-full" style={{ minWidth: "300px" }}>
            <div
              className="grid grid-cols-4 gap-1 sm:gap-2 w-full p-1 sm:p-2"
              style={{ gridTemplateRows: "auto auto auto auto" }}
            >
              {SOUTH_INDIAN_LAYOUT.map((layout, index) => (
                <div key={index} className={layout.gridPos}>
                  <ChartBox
                    index={layout.rashiIndex}
                    ascendantSignIndex={ascendantSignIndex}
                    chartData={chartData}
                    isTransit={isTransit}
                    selectedPlanet={selectedPlanet}
                    isAspected={
                      selectedPlanet &&
                      isHouseAspected(
                        layout.rashiIndex,
                        chartData?.planets[selectedPlanet]
                      )
                    }
                  />
                </div>
              ))}

              {/* Center box */}
              <div className="row-start-2 col-start-2 row-span-2 col-span-2 border-gray-300 border-1 bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center items-center p-2 sm:p-6">
                <h4 className="text-lg sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-4 text-center">
                  {isTransit ? "🌙 Transit" : "⭐ Birth Chart"}
                </h4>
                {centerContent}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

SouthIndianChart.displayName = "SouthIndianChart";

// Main Component
const SwissEphComponent = () => {
  const [swe, setSwe] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [birthChart, setBirthChart] = useState(null);
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [transitChart, setTransitChart] = useState(null);
  const [birthData, setBirthData] = useState({
    year: 2000,
    month: 7,
    day: 1,
    hour: 7,
    minute: 12,
    timezone: 5.5,
    latitude: 9.9252,
    longitude: 78.1198,
  });
  const [selectedAyanamsha, setSelectedAyanamsha] = useState(
    "SE_SIDM_KRISHNAMURTI"
  );

  const isHouseAspected = useCallback(
    (houseIndex, planetDetails) => {
      if (!selectedPlanet || !planetDetails) return false;
      const planetHouse = planetDetails.rashiIndex;
      const aspects = ASTRO_DATA.ASPECTS[selectedPlanet] || [];
      return aspects.some(
        (aspect) => (planetHouse + aspect - 1) % 12 === houseIndex
      );
    },
    [selectedPlanet]
  );

  // Initialize SwissEph
  useEffect(() => {
    let mounted = true;
    const initSwissEph = async () => {
      try {
        setLoading(true);
        setError("");
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
    return () => {
      mounted = false;
    };
  }, []);

  const calculateChart = useCallback(
    async (isTransit = false) => {
      if (!isInitialized || !swe) return;

      try {
        setLoading(true);
        setError("");

        const date = isTransit ? new Date() : birthData;
        const jd = isTransit
          ? swe.julday(
              date.getFullYear(),
              date.getMonth() + 1,
              date.getDate(),
              date.getHours() + date.getMinutes() / 60
            )
          : swe.julday(
              date.year,
              date.month,
              date.day,
              date.hour + date.minute / 60 - date.timezone
            );

        swe.set_sid_mode(swe[selectedAyanamsha], 0, 0);

        const chart = { planets: {}, houses: {}, ascendant: null };

        // Calculate planetary positions
        for (const planet of PLANETS) {
          try {
            const planetId =
              planet === "Rahu" || planet === "Ketu"
                ? swe.SE_TRUE_NODE
                : swe[`SE_${planet.toUpperCase()}`];
            const pos = swe.calc_ut(
              jd,
              planetId,
              swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL
            );
            let longitude = planet === "Ketu" ? (pos[0] + 180) % 360 : pos[0];

            chart.planets[planet] = {
              longitude,
              ...getRashi(longitude),
              isRetro: pos[3] < 0 ? "true" : "false",
            };
          } catch (err) {
            console.error(`Error calculating ${planet}:`, err);
          }
        }

        // Calculate houses for birth chart
        if (!isTransit) {
          try {
            const houses = swe.houses(
              jd,
              birthData.latitude,
              birthData.longitude,
              "P"
            );
            const ayanamsha_value = swe.get_ayanamsa(jd);
            const asc_sidereal =
              (houses.cusps[1] - ayanamsha_value + 360) % 360;

            chart.ascendant = {
              longitude: asc_sidereal,
              ...getRashi(asc_sidereal),
            };

            for (let i = 1; i <= 12; i++) {
              const house_sidereal =
                (houses.cusps[i] - ayanamsha_value + 360) % 360;
              chart.houses[`House${i}`] = {
                longitude: house_sidereal,
                ...getRashi(house_sidereal),
              };
            }
          } catch (err) {
            console.error("Error calculating houses:", err);
          }
        }

        isTransit ? setTransitChart(chart) : setBirthChart(chart);
      } catch (err) {
        setError(`Error calculating chart: ${err.message}`);
      } finally {
        setLoading(false);
      }
    },
    [isInitialized, swe, birthData, selectedAyanamsha]
  );

  const handleInputChange = useCallback((field, value) => {
    setBirthData((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }));
  }, []);

  const handlePlanetSelect = useCallback((planet) => {
    setSelectedPlanet(planet === "" ? null : planet);
  }, []);

  const calculateBirthChart = useCallback(
    () => calculateChart(false),
    [calculateChart]
  );

  const calculateTransitChart = useCallback(
    () => calculateChart(true),
    [calculateChart]
  );

  return (
    <div className="w-full mx-auto p-2 sm:p-4 font-sans bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="text-center mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 sm:mb-4">
          Vedic Astrology Chart Calculator
        </h1>
        <div className="flex items-center justify-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isInitialized
                ? "bg-green-500"
                : loading
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
          ></div>
          <span className="text-xs sm:text-sm text-gray-600">
            {loading ? "Loading..." : isInitialized ? "Ready" : "Error"}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-4 sm:mb-6 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* Form Section */}
      <FormSection
        birthData={birthData}
        onInputChange={handleInputChange}
        selectedAyanamsha={selectedAyanamsha}
        onAyanamshaChange={setSelectedAyanamsha}
        onCalculateBirth={calculateBirthChart}
        onCalculateTransit={calculateTransitChart}
        loading={loading}
        isInitialized={isInitialized}
      />

      {/* Charts Section */}
      <div className="space-y-4 sm:space-y-8">
        {birthChart && (
          <SouthIndianChart
            chartData={birthChart}
            isTransit={false}
            birthData={birthData}
            selectedPlanet={selectedPlanet}
            onPlanetSelect={handlePlanetSelect}
            isHouseAspected={isHouseAspected}
          />
        )}
        {transitChart && (
          <SouthIndianChart
            chartData={transitChart}
            isTransit={true}
            birthData={birthData}
            selectedPlanet={selectedPlanet}
            onPlanetSelect={handlePlanetSelect}
            isHouseAspected={isHouseAspected}
          />
        )}
      </div>
    </div>
  );
};

export default SwissEphComponent;
