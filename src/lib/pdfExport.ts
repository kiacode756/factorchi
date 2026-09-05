import { Invoice, Profile } from '../types';
import { formatToman, toPersianDigits, formatPersianDate } from './utils';

/**
 * Generates and prints a clean, standalone, high-resolution Persian PDF invoice.
 * It opens an isolated hidden print iframe and triggers window.print(),
 * allowing the user to either save as PDF or print on A4/A5 with zero UI clutter.
 */
export function exportInvoiceToPdf(invoice: Invoice, profile?: Profile | null) {
  if (!invoice) return;

  const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = Math.round(Math.max(0, subtotal - invoice.discount) * (invoice.tax_rate / 100));
  const businessName = profile?.business_name || 'فاکتور فروش کالا و خدمات';
  const issuerName = profile?.full_name || '';
  const issuerPhone = profile?.phone ? toPersianDigits(profile.phone) : '';
  const formattedDate = formatPersianDate(invoice.created_at);

  const itemsRows = invoice.items
    .map(
      (item, idx) => `
      <tr>
        <td style="text-align: center; color: #64748b; font-family: monospace; padding: 8px;">${toPersianDigits(idx + 1)}</td>
        <td style="font-weight: 600; color: #1e293b; padding: 8px;">${escapeHtml(item.name)}</td>
        <td style="text-align: center; color: #334155; padding: 8px;">${toPersianDigits(item.quantity)}</td>
        <td style="text-align: left; direction: ltr; font-family: monospace; color: #334155; padding: 8px;">${formatToman(item.unit_price)}</td>
        <td style="text-align: left; direction: ltr; font-family: monospace; font-weight: 700; color: #0f172a; padding: 8px;">${formatToman(item.quantity * item.unit_price)}</td>
      </tr>
    `
    )
    .join('');

  const paymentInfoHtml =
    profile?.card_number || profile?.sheba_number
      ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 11px; line-height: 1.8;">
        <strong style="color: #0f172a; display: block; margin-bottom: 4px;">اطلاعات پرداخت و واریز وجه:</strong>
        ${profile.card_number ? `<div>شماره کارت: <span style="font-family: monospace; font-weight: bold; letter-spacing: 1px;" dir="ltr">${escapeHtml(profile.card_number)}</span></div>` : ''}
        ${profile.sheba_number ? `<div>شماره شبا: <span style="font-family: monospace;" dir="ltr">${escapeHtml(profile.sheba_number)}</span></div>` : ''}
        ${profile.card_holder_name || profile.bank_name ? `<div style="color: #64748b;">به نام: ${escapeHtml(profile.card_holder_name || profile.full_name || '')} ${profile.bank_name ? `(${escapeHtml(profile.bank_name)})` : ''}</div>` : ''}
      </div>
    `
      : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>فاکتور ${escapeHtml(invoice.invoice_number)} - ${escapeHtml(businessName)}</title>
      <style>
        @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Vazirmatn', system-ui, -apple-system, sans-serif;
        }
        @page {
          size: A4 portrait;
          margin: 15mm 12mm 15mm 12mm;
        }
        body {
          background-color: #ffffff;
          color: #0f172a;
          font-size: 12px;
          line-height: 1.5;
          padding: 20px;
        }
        .invoice-card {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          background: #ffffff;
        }
        .header-table {
          width: 100%;
          border-bottom: 2px solid #0d9488;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .business-title {
          font-size: 20px;
          font-weight: 900;
          color: #0f766e;
          margin-bottom: 4px;
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: bold;
        }
        .badge-paid {
          background-color: #dcfce7;
          color: #166534;
        }
        .badge-unpaid {
          background-color: #f1f5f9;
          color: #475569;
        }
        .info-box {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .items-table th {
          background-color: #f1f5f9;
          color: #334155;
          font-weight: 700;
          padding: 10px 8px;
          border: 1px solid #e2e8f0;
          font-size: 11.5px;
        }
        .items-table td {
          border: 1px solid #e2e8f0;
          font-size: 11.5px;
        }
        .items-table tbody tr:nth-child(even) {
          background-color: #fafafa;
        }
        .summary-wrapper {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 20px;
        }
        .summary-table {
          width: 280px;
          border-collapse: collapse;
        }
        .summary-table td {
          padding: 6px 4px;
          font-size: 11.5px;
        }
        .total-row td {
          border-top: 2px solid #0d9488;
          font-size: 14px;
          font-weight: 900;
          color: #0f766e;
          padding-top: 8px;
        }
        .footer-note {
          border-top: 1px dashed #cbd5e1;
          padding-top: 12px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 11px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <!-- Top Header -->
        <table class="header-table">
          <tr>
            <td style="vertical-align: top; width: 60%;">
              <div class="business-title">${escapeHtml(businessName)}</div>
              ${issuerName ? `<div style="color: #475569; font-size: 11.5px; font-weight: 500;">صادرکننده: ${escapeHtml(issuerName)}</div>` : ''}
              ${issuerPhone ? `<div style="color: #64748b; font-size: 11px;">تلفن تماس: ${issuerPhone}</div>` : ''}
            </td>
            <td style="text-align: left; vertical-align: top; width: 40%;">
              <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">
                شماره فاکتور: <span style="font-family: monospace;">${escapeHtml(invoice.invoice_number)}</span>
              </div>
              <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">
                تاریخ صدور: ${formattedDate}
              </div>
              <div>
                <span class="badge ${invoice.status === 'paid' ? 'badge-paid' : 'badge-unpaid'}">
                  ${invoice.status === 'paid' ? 'پرداخت شده ✓' : 'در انتظار تسویه و پرداخت'}
                </span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Customer Box -->
        <table style="width: 100%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px; padding: 8px 12px;">
          <tr>
            <td>
              <span style="color: #64748b;">خریدار محترم: </span>
              <strong style="color: #0f172a; font-size: 12.5px;">${escapeHtml(invoice.customer_name || 'مشتری گرامی')}</strong>
            </td>
            ${
              invoice.customer_phone
                ? `<td style="text-align: left;">
                    <span style="color: #64748b;">شماره تماس: </span>
                    <span style="font-family: monospace; font-weight: 600; color: #334155;" dir="ltr">${escapeHtml(invoice.customer_phone)}</span>
                   </td>`
                : ''
            }
          </tr>
        </table>

        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">ردیف</th>
              <th style="text-align: right;">شرح کالا یا خدمات</th>
              <th style="width: 60px; text-align: center;">تعداد</th>
              <th style="width: 120px; text-align: left;">قیمت واحد (تومان)</th>
              <th style="width: 130px; text-align: left;">قیمت کل (تومان)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Summary & Totals -->
        <div class="summary-wrapper">
          <table class="summary-table">
            <tr>
              <td style="color: #64748b;">جمع کل اقلام:</td>
              <td style="text-align: left; font-family: monospace; font-weight: 600;" dir="ltr">${formatToman(subtotal)}</td>
            </tr>
            ${
              invoice.discount > 0
                ? `<tr>
                    <td style="color: #e11d48;">مبلغ تخفیف${invoice.discount_type === 'percent' && invoice.discount_percent ? ` (${toPersianDigits(invoice.discount_percent)}٪)` : ''}:</td>
                    <td style="text-align: left; font-family: monospace; font-weight: 600; color: #e11d48;" dir="ltr">- ${formatToman(invoice.discount)}</td>
                  </tr>`
                : ''
            }
            ${
              invoice.tax_rate > 0
                ? `<tr>
                    <td style="color: #64748b;">مالیات (${toPersianDigits(invoice.tax_rate)}٪):</td>
                    <td style="text-align: left; font-family: monospace; font-weight: 600;" dir="ltr">+ ${formatToman(taxAmount)}</td>
                  </tr>`
                : ''
            }
            <tr class="total-row">
              <td>مبلغ نهایی فاکتور:</td>
              <td style="text-align: left; font-family: monospace;" dir="ltr">${formatToman(invoice.total_amount)}</td>
            </tr>
          </table>
        </div>

        <!-- Payment & Footer -->
        <div style="margin-top: 10px;">
          ${paymentInfoHtml}
          ${invoice.notes ? `<div style="margin-top: 10px; font-size: 11px; color: #475569; font-style: italic;">یادداشت: ${escapeHtml(invoice.notes)}</div>` : ''}
        </div>

        <div class="footer-note" style="margin-top: 24px;">
          <div>صادر شده توسط سامانه هوشمند فاکتورچی</div>
          <div>تاریخ چاپ: ${toPersianDigits(new Date().toLocaleDateString('fa-IR'))}</div>
        </div>
      </div>
      <script>
        window.onload = function() {
          window.focus();
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  // Create clean isolated iframe to print or save as PDF
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.srcdoc = htmlContent;

  document.body.appendChild(iframe);

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('Iframe print fallback triggered:', err);
      window.print();
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 60000);
  }, 350);
}

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
