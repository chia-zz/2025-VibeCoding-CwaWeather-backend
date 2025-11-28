require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
// 【步驟 1】載入 IP 地址簿工具 (geoip-lite)
const geoip = require("geoip-lite");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 【IP 輔助函式：現在是真正的 IP 查詢了！】 ---

/**
 * 透過 IP 查找使用者所在城市。
 * 使用 geoip-lite 查找到城市後，進行城市名稱轉換。
 * @param {string} ip - 傳入使用者的 IP 地址。
 * @returns {string} 推測的城市名稱 (CWA 格式，例如: 臺北市)。
 */
const getCityFromIp = (ip) => {
  //
  // 【重要提醒】：在測試環境 (例如本地電腦) 上，你的 IP (127.0.0.1 或 ::1)
  // 查不到地理位置，會直接返回 null 或空值，所以需要後備方案。
  //

  // 1. 查詢 IP
  const geo = geoip.lookup(ip);

  // 2. 判斷是否有查到位置
  if (geo && geo.city) {
    // 假設 geoip-lite 查到了英文城市名，例如 'Taipei'
    const englishCity = geo.city;

    // 3. 進行名稱轉換（這裡需要你自己建立一個完整的對應表）
    //
    // 💡 為了讓偵測更準確，我們根據你提供的 CWA 城市清單，補上幾個重要的城市對應
    switch (englishCity.toLowerCase()) {
      case "taipei":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 臺北市`);
        return "臺北市";
      case "new taipei":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 新北市`);
        return "新北市";
      case "taoyuan":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 桃園市`);
        return "桃園市";
      case "taichung":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 臺中市`);
        return "臺中市";
      case "tainan":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 臺南市`);
        return "臺南市";
      case "kaohsiung":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 高雄市`);
        return "高雄市";
      case "keelung":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 基隆市`);
        return "基隆市";
      case "hsinchu":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 新竹市`);
        return "新竹市";
      case "chiayi":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 嘉義市`);
        return "嘉義市";
      case "yilan":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 宜蘭縣`);
        return "宜蘭縣";
      case "hualien":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 花蓮縣`);
        return "花蓮縣";
      case "taitung":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 臺東縣`);
        return "臺東縣";
      case "penghu":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 澎湖縣`);
        return "澎湖縣";
      case "kinmen":
        console.log(`IP 偵測到城市: ${englishCity}, 轉換為: 金門縣`);
        return "金門縣";
      default:
        // 如果 IP 查到的英文城市名不在列表，使用臺北市作為預設值
        console.log(
          `IP 偵測到城市: ${englishCity}, 找不到中文對應名稱，使用預設值。`
        );
        return "臺北市";
    }
  }

  // 如果 IP 查不到地理位置 (例如在本地開發時)，則使用後備城市
  console.log(`IP 查詢失敗或 IP 為本地 IP (${ip})，使用預設城市。`);
  return "臺北市";
};

// ------------------------------------------

/**
 * 取得指定城市的天氣預報
 * CWA 氣象資料開放平臺 API
 * 使用「一般天氣預報-今明 36 小時天氣預報」資料集
 * 這是 /api/weather/:city 使用的通用邏輯
 */
const getWeatherByCity = async (req, res, city) => {
  const targetCity = city || req.params.city; // 接受路徑參數或傳入的城市

  try {
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    if (!targetCity) {
      return res.status(400).json({
        error: "參數錯誤",
        message: "請在路徑中提供城市名稱，例如 /api/weather/臺北市",
      });
    }

    // 呼叫 CWA API - 一般天氣預報（36小時）
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
          locationName: targetCity, // 使用目標城市名稱
        },
      }
    );

    const locationData = response.data.records.location[0];

    if (!locationData) {
      return res.status(404).json({
        error: "查無資料",
        message: `無法取得 ${targetCity} 天氣資料，請檢查城市名稱是否正確 (可用的城市: 宜蘭縣, 臺北市, 臺中市, 高雄市, ... 等 22 縣市)`,
      });
    }

    // 整理天氣資料 (略，與原邏輯相同)
    const weatherData = {
      city: locationData.locationName,
      updateTime: response.data.records.datasetDescription,
      forecasts: [],
    };

    const weatherElements = locationData.weatherElement;
    const timeCount = weatherElements[0].time.length;

    for (let i = 0; i < timeCount; i++) {
      const forecast = {
        startTime: weatherElements[0].time[i].startTime,
        endTime: weatherElements[0].time[i].endTime,
        weather: "",
        rain: "",
        minTemp: "",
        maxTemp: "",
        comfort: "",
        windSpeed: "",
      };

      weatherElements.forEach((element) => {
        const value = element.time[i].parameter;
        switch (element.elementName) {
          case "Wx":
            forecast.weather = value.parameterName;
            break;
          case "PoP":
            forecast.rain = value.parameterName + "%";
            break;
          case "MinT":
            forecast.minTemp = value.parameterName + "°C";
            break;
          case "MaxT":
            forecast.maxTemp = value.parameterName + "°C";
            break;
          case "CI":
            forecast.comfort = value.parameterName;
            break;
          case "WS":
            forecast.windSpeed = value.parameterName;
            break;
        }
      });

      weatherData.forecasts.push(forecast);
    }

    res.json({
      success: true,
      data: weatherData,
    });
  } catch (error) {
    console.error(`取得 ${targetCity} 天氣資料失敗:`, error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得天氣資料",
        details: error.response.data,
      });
    }

    res.status(500).json({
      error: "伺服器錯誤",
      message: "無法取得天氣資料，請稍後再試",
    });
  }
};

/**
 * 取得使用者當前位置的天氣預報
 * 透過 IP 判斷城市，然後呼叫 getWeatherByCity 函式
 */
const getWeatherCurrent = async (req, res) => {
  // 1. 取得使用者的 IP 地址
  const userIp = req.ip;

  // 2. 透過 IP 查找推測的城市名稱 (現在是使用真正的 geoip 工具了!)
  const inferredCity = getCityFromIp(userIp);

  // 3. 呼叫通用的查詢函式，並傳入推測的城市名稱
  await getWeatherByCity(req, res, inferredCity);
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API - 全台灣城市查詢版",
    endpoints: {
      // 自動定位路徑
      currentLocation: "/api/weather/current (根據 IP 自動定位)",
      cityWeather: "/api/weather/:city (例如: /api/weather/臺北市)",
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 💡 【修正後的順序】:
// 1. 先設定固定的、特定的路徑 (current)
app.get("/api/weather/current", getWeatherCurrent);

// 2. 再設定通用的、有變數的路徑 (:city)
app.get("/api/weather/:city", (req, res) =>
  getWeatherByCity(req, res, req.params.city)
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "找不到此路徑",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行已運作`);
  console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
});
