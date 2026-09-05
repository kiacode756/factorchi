// Persian numbers and currency helpers

export function toPersianDigits(n: number | string | undefined | null): string {
  if (n === undefined || n === null) return '';
  const str = String(n);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (w) => persianDigits[+w]);
}

export function persianToEnglishDigits(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = String(str);
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(persianDigits[i], String(i));
    res = res.replaceAll(arabicDigits[i], String(i));
  }
  return res;
}

export function formatToman(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '۰ تومان';
  const formatted = Math.round(amount).toLocaleString('en-US');
  return `${toPersianDigits(formatted)} تومان`;
}

export function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '۰';
  return toPersianDigits(n.toLocaleString('en-US'));
}

/**
 * Formats a bank card number cleanly with English digits in 4-digit blocks (e.g. 6037 - 9975 - 1234 - 5678)
 */
export function formatCardNumberEnglish(cardNumber: string | undefined | null): string {
  if (!cardNumber) return '---- - ---- - ---- - ----';
  const english = persianToEnglishDigits(cardNumber);
  const clean = english.replace(/[^0-9]/g, '');
  if (!clean) return '---- - ---- - ---- - ----';
  const parts = clean.match(/.{1,4}/g) || [clean];
  return parts.join(' - ');
}

/**
 * Adds thousand separator commas to numbers/strings.
 * e.g., 1500000 -> 1,500,000
 */
export function formatNumberWithCommas(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const latin = persianToEnglishDigits(value);
  const cleanStr = latin.replace(/,/g, '').replace(/[^0-9]/g, '');
  if (!cleanStr) return '';
  return cleanStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Removes thousand separator commas to get raw numeric string
 */
export function removeCommas(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const latin = persianToEnglishDigits(value);
  return latin.replace(/,/g, '').trim();
}

/**
 * Persian number words mapping to English numbers
 */
export const persianNumberWords: Record<string, number> = {
  'صفر': 0, 'یک': 1, 'یه': 1, 'یکعدد': 1, 'دو': 2, 'دوعدد': 2, 'سه': 3, 'سهعدد': 3,
  'چهار': 4, 'چهارعدد': 4, 'پنج': 5, 'پنجعدد': 5, 'شش': 6, 'شیش': 6, 'ششعدد': 6,
  'هفت': 7, 'هفتعدد': 7, 'هشت': 8, 'هشتعدد': 8, 'نه': 9, 'نهعدد': 9, 'ده': 10, 'دهعدد': 10,
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'پونزده': 15,
  'شانزده': 16, 'شونزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19, 'بیست': 20,
  'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
  'صد': 100, 'یکصد': 100, 'دویست': 200, 'سیصد': 300, 'چهارصد': 400, 'پانصد': 500, 'پونصد': 500,
  'ششصد': 600, 'هفتصد': 700, 'هشتصد': 800, 'نهصد': 900,
  'هزار': 1000, 'میلیون': 1000000,
};

export function parsePersianNumbers(text: string): string {
  if (!text) return '';
  let result = text;
  // Replace compound phrases first
  result = result.replace(/دو\s*عدد/g, '2 عدد');
  result = result.replace(/یک\s*عدد/g, '1 عدد');
  result = result.replace(/سه\s*عدد/g, '3 عدد');
  result = result.replace(/چهار\s*عدد/g, '4 عدد');
  result = result.replace(/پنج\s*عدد/g, '5 عدد');
  result = result.replace(/شش\s*عدد/g, '6 عدد');
  result = result.replace(/شیش\s*عدد/g, '6 عدد');
  result = result.replace(/هفت\s*عدد/g, '7 عدد');
  result = result.replace(/هشت\s*عدد/g, '8 عدد');
  result = result.replace(/نه\s*عدد/g, '9 عدد');
  result = result.replace(/ده\s*عدد/g, '10 عدد');
  return persianToEnglishDigits(result);
}

export function formatPersianDate(dateString: string | undefined | null): string {
  if (!dateString) return 'امروز';
  try {
    const d = new Date(dateString);
    // Simple Persian relative or formatted representation
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return new Intl.DateTimeFormat('fa-IR', options).format(d);
  } catch {
    return dateString;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
      return true;
    }
  } catch (err) {
    console.error('Failed to copy: ', err);
    return false;
  }
}

/**
 * Formats a phone number for international WhatsApp link (wa.me)
 * Converts Persian/Arabic digits, strips non-digits, handles leading 0/98/+98,
 * and ensures proper Iran prefix (98) without duplicate prefix.
 */
export function formatPhoneForWhatsApp(phone: string | undefined | null): string {
  if (!phone) return '';
  
  // Convert Persian and Arabic numbers to Latin digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  
  let cleaned = String(phone).trim();
  persianDigits.forEach((pd, idx) => {
    cleaned = cleaned.replaceAll(pd, String(idx));
  });
  arabicDigits.forEach((ad, idx) => {
    cleaned = cleaned.replaceAll(ad, String(idx));
  });

  // Remove all non-digit characters
  cleaned = cleaned.replace(/\D/g, '');

  if (!cleaned) return '';

  // If user entered only 98 or 0 (or shorter than 7 digits), it's not a complete number
  if (cleaned === '98' || cleaned === '0' || cleaned.length < 7) {
    return '';
  }

  // Remove leading international prefixes: 0098 or 98
  if (cleaned.startsWith('0098')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('98') && cleaned.length > 9) {
    cleaned = cleaned.substring(2);
  }

  // Remove leading zeros (e.g. 0912... -> 912...)
  while (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Valid Iranian mobile numbers are 10 digits after removing leading 0 (e.g. 9121234567)
  // or at least 7-8 digits for landline with area code
  if (cleaned.length >= 7) {
    return '98' + cleaned;
  }

  return '';
}

