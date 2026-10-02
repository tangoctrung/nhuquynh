import { DAYS } from "@/types";

export interface SimpleDeviceInfo {
  deviceName: string; // Tên thiết bị / Hệ điều hành (ví dụ: iPhone, Android, Mac, Windows)
  browserName: string; // Tên trình duyệt (ví dụ: Chrome, Safari, Firefox, Edge)
}

const getSimpleDeviceInfo = (): SimpleDeviceInfo => {
  const ua = navigator.userAgent;

  // 1. Nhận biết Trình duyệt (Kiểm tra theo thứ tự ưu tiên)
  let browserName = "Unknown Browser";
  if (ua.includes("Firefox/") && !ua.includes("Seamonkey/")) {
    browserName = "Firefox";
  } else if (ua.includes("Edg/")) {
    browserName = "Edge"; // Edge Chromium
  } else if (ua.includes("OPR/") || ua.includes("Opera/")) {
    browserName = "Opera";
  } else if (ua.includes("Chrome/") && !ua.includes("Chromium/")) {
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

  return { deviceName, browserName };
};

export function sendMessageTelegram(message: string) {
  let token_bot = process.env.NEXT_PUBLIC_BOT_TELEGRAM_TOKEN || "";
  let chat_id = process.env.NEXT_PUBLIC_CHAT_ID || "";

  const { browserName, deviceName } = getSimpleDeviceInfo();
  const text =
    "Nhu Quynh: " + message + " trên " + deviceName + "/" + browserName;
  fetch(
    `https://api.telegram.org/bot${token_bot}/sendMessage?chat_id=${chat_id}&text=${text}`,
    {
      method: "POST",
    },
  )
    .then((res) => {
      console.log({ res });
    })
    .catch((err) => {
      console.log(err);
    });
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
  if (day === 25 && month === 10) {
    return "25/10";
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
