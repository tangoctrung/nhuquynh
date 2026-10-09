import { DAYS } from "@/types";

export interface SimpleDeviceInfo {
  deviceName: string; // Tên thiết bị / Hệ điều hành (ví dụ: iPhone, Android, Mac, Windows)
  browserName: string; // Tên trình duyệt (ví dụ: Chrome, Safari, Firefox, Edge)
  browserVersion: string;
  ip: string;
  language: string;
  timezone: string;
  platform: string;
  screenSize: string;
  viewportSize: string;
  pixelRatio: number;
  cpuCores: number | null;
  deviceMemory: number | null;
  touchPoints: number;
  cookiesEnabled: boolean;
  userAgent: string;
}

const getIp = async (): Promise<string> => {
  const endpoints = [
    "https://api64.ipify.org?format=json",
    "https://api.ipify.org?format=json",
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`IP lookup failed: ${endpoint} (HTTP ${response.status})`);
        continue;
      }

      const data: { ip?: unknown } | null = await response.json();
      if (typeof data?.ip === "string" && data.ip.trim()) {
        return data.ip.trim();
      }

      console.warn(`IP lookup returned no IP: ${endpoint}`);
    } catch (error) {
      console.warn(`IP lookup failed: ${endpoint}`, error);
    } finally {
      clearTimeout(timeout);
    }
  }

  return "Unknown IP";
};

const getSimpleDeviceInfo = async (): Promise<SimpleDeviceInfo> => {
  const ua = navigator.userAgent;
  const browserPatterns: Record<string, RegExp> = {
    Firefox: /(?:Firefox|FxiOS)\/([\d.]+)/,
    Edge: /(?:Edg|EdgA|EdgiOS)\/([\d.]+)/,
    Opera: /(?:OPR|Opera|OPiOS)\/([\d.]+)/,
    Chrome: /(?:Chrome|CriOS)\/([\d.]+)/,
    Safari: /Version\/([\d.]+)/,
  };

  // 1. Nhận biết Trình duyệt (Kiểm tra theo thứ tự ưu tiên)
  let browserName = "Unknown Browser";
  if (browserPatterns.Firefox.test(ua) && !ua.includes("Seamonkey/")) {
    browserName = "Firefox";
  } else if (browserPatterns.Edge.test(ua)) {
    browserName = "Edge"; // Edge Chromium
  } else if (browserPatterns.Opera.test(ua)) {
    browserName = "Opera";
  } else if (browserPatterns.Chrome.test(ua) && !ua.includes("Chromium/")) {
    browserName = "Chrome";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
    browserName = "Safari";
  }

  // 2. Nhận biết Thiết bị / Hệ điều hành
  let deviceName = "Unknown Device";
  if (/iPhone/i.test(ua)) {
    deviceName = "iPhone";
  } else if (/iPad/i.test(ua)) {
    deviceName = "iPad";
  } else if (/Android/i.test(ua)) {
    deviceName = "Android Device";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    // Nhận biết iPadOS giả lập Desktop trên Safari
    if (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) {
      deviceName = "iPad";
    } else {
      deviceName = "Macbook / Mac";
    }
  } else if (/Windows/i.test(ua)) {
    deviceName = "Windows PC";
  } else if (/Linux/i.test(ua)) {
    deviceName = "Linux PC";
  }

  const browserVersion =
    browserPatterns[browserName]?.exec(ua)?.[1] || "Unknown Version";
  const { deviceMemory } = navigator as Navigator & { deviceMemory?: number };
  const deviceInfo = {
    deviceName,
    browserName,
    browserVersion,
    language:
      navigator.languages?.join(", ") || navigator.language || "Unknown",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
    platform: navigator.platform || "Unknown",
    screenSize: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    pixelRatio: window.devicePixelRatio || 1,
    cpuCores: navigator.hardwareConcurrency || null,
    deviceMemory: deviceMemory ?? null,
    touchPoints: navigator.maxTouchPoints || 0,
    cookiesEnabled: navigator.cookieEnabled,
    userAgent: ua,
  };

  return { ...deviceInfo, ip: await getIp() };
};

export async function sendMessageTelegram(
  message: string,
  isSendInfoDevice?: boolean,
): Promise<boolean> {
  let token_bot = process.env.NEXT_PUBLIC_BOT_TELEGRAM_TOKEN || "";
  let chat_id = process.env.NEXT_PUBLIC_CHAT_ID || "";
  if (!token_bot || !chat_id) return false;
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  let text: string = "";
  try {
    if (isSendInfoDevice) {
      const info = await getSimpleDeviceInfo();
      text = [
        `Nhu Quynh: ${message} trên ${info.deviceName}/${info.browserName}`,
        `IP: ${info.ip}`,
        `Trình duyệt: ${info.browserName} ${info.browserVersion}`,
        `Nền tảng: ${info.platform}`,
        `Ngôn ngữ: ${info.language}`,
        `Múi giờ: ${info.timezone}`,
        `Màn hình: ${info.screenSize}`,
        `Viewport: ${info.viewportSize}`,
        `Tỉ lệ pixel: ${info.pixelRatio}`,
        `CPU (luồng): ${info.cpuCores ?? "Unknown"}`,
        `RAM (ước lượng): ${info.deviceMemory == null ? "Unknown" : `${info.deviceMemory} GB`}`,
        `Điểm chạm tối đa: ${info.touchPoints}`,
        `Cookie: ${info.cookiesEnabled ? "Bật" : "Tắt"}`,
        `User-Agent: ${info.userAgent}`,
      ].join("\n");
    } else {
      text = `Nhu Quynh: ${message}`;
    }

    const params = new URLSearchParams({
      chat_id,
      text,
    });

    timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(
      `https://api.telegram.org/bot${token_bot}/sendMessage`,
      {
        method: "POST",
        body: params,
        signal: controller.signal,
      },
    );

    const result: { ok?: boolean } = await res.json();
    return res.ok && result.ok === true;
  } catch (err) {
    console.log(err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function returnTypeDays(day: number, month: number): DAYS {
  if (day === 1 && month === 1) {
    return "1/1";
  }
  if (day === 14 && month === 2) {
    return "14/2";
  }
  if (day === 8 && month === 3) {
    return "8/3";
  }
  if (day === 14 && month === 3) {
    return "14/3";
  }
  if (day === 20 && month === 10) {
    return "20/10";
  }
  return "";
}

export function formatTimeHourNormalDay() {
  const timeNow = new Date();
  const hour =
    timeNow.getHours() >= 10 ? timeNow.getHours() : "0" + timeNow.getHours();
  const minutes =
    timeNow.getMinutes() >= 10
      ? timeNow.getMinutes()
      : "0" + timeNow.getMinutes();
  const second =
    timeNow.getSeconds() >= 10
      ? timeNow.getSeconds()
      : "0" + timeNow.getSeconds();
  return hour + ":" + minutes + ":" + second;
}

export function formatTimeNormalDay() {
  const days = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ];
  const timeNow = new Date();
  const dayOfWeek = days[timeNow.getDay()];
  const day = timeNow.getDate();
  const month = timeNow.getMonth() + 1;
  const year = timeNow.getFullYear();
  return dayOfWeek + ", " + day + " tháng " + month + " " + year;
}

export function formatTimeHolidayNormalDay() {
  const days = [
    { title: "Tết Dương Lịch", day: "1/1", value: "1/1" },
    { title: "Valentine's", day: "14/2", value: "02/14" },
    { title: "Quốc tế Phụ nữ", day: "8/3", value: "03/08" },
    { title: "Phụ nữ Việt Nam", day: "20/10", value: "10/20" },
    { title: "Sinh nhật LeeVyy", day: "25/10", value: "10/25" },
    { title: "Giáng Sinh", day: "25/12", value: "12/25" },
  ];
  const timeNow = new Date();
  const year = timeNow.getFullYear();

  const timeDayStart = new Date(
    year.toString() + "/" + days[1].value,
  ).getTime();
  if (timeDayStart > timeNow.getTime()) {
    return days[1].title + " (" + days[1].day + ")";
  }

  const timeDayEnd = new Date(
    year.toString() + "/" + days[days.length - 1].value,
  ).getTime();
  if (timeDayEnd < timeNow.getTime()) {
    return days[0].title + " (" + days[0].day + "/" + (year + 1) + ")";
  }

  let indexOfDay = 0;
  for (let index = 1; index < days.length; index++) {
    const timeDayBefore = new Date(
      year.toString() + "/" + days[index - 1].value,
    ).getTime();
    const timeDay = new Date(
      year.toString() + "/" + days[index].value,
    ).getTime();
    if (timeDayBefore < timeNow.getTime() && timeNow.getTime() < timeDay) {
      indexOfDay = index;
      break;
    }
  }
  return days[indexOfDay].title + " (" + days[indexOfDay].day + ")";
}
