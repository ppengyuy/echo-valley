import * as ExcelJS from 'exceljs';
import {
  COPY,
  EXCEL_FOOTER_LEFT,
  EXCEL_NOTES_TXT,
  EXCEL_SHEETS,
} from '../copy';
import type { Plan, PlanItem, PlanStatus } from '../types';
import { addDays, fromIso, formatMinutes, isoDate } from '../utils/date';

const INK = 'FF3A3A38';
const INK_SOFT = 'FF6E6A62';
const INK_FAINT = 'FF8A8A84';
const PAPER = 'FFFBF8F3';
const HEADER = 'FFEAE3D6';
const BUFFER = 'FFF1EFE7';
const BORDER = 'FFD8D2C6';
const REST = 'FFE8EEF2';
const LATER = 'FFF3EFE7';
const FONT = '微软雅黑';

const thin = { style: 'thin' as const, color: { argb: BORDER } };

const borderAll = { top: thin, left: thin, bottom: thin, right: thin };

function styleSheet(ws: ExcelJS.Worksheet, widths: number[], headerRow = 3, lastRow = 12) {
  widths.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
  ws.properties.defaultRowHeight = 22;
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printArea: 'A1:F20',
    margins: { left: 0.59, right: 0.59, top: 0.59, bottom: 0.59, header: 0.3, footer: 0.3 },
  };
  ws.headerFooter = {
    oddFooter: `&L${EXCEL_FOOTER_LEFT}&R第 &P 页 / 共 &N 页`,
  };

  ws.getRow(1).height = 30;
  ws.getRow(2).height = 20;
  ws.getRow(headerRow).height = 24;
  for (let row = headerRow + 1; row <= lastRow; row += 1) ws.getRow(row).height = 28;

  ws.mergeCells(1, 1, 1, 6);
  ws.mergeCells(2, 1, 2, 6);

  const title = ws.getCell(1, 1);
  title.font = { name: FONT, size: 16, color: { argb: INK } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };

  const subtitle = ws.getCell(2, 1);
  subtitle.font = { name: FONT, size: 10.5, color: { argb: INK_SOFT } };
  subtitle.alignment = { vertical: 'middle', horizontal: 'left' };

  for (let col = 1; col <= 6; col += 1) {
    const cell = ws.getCell(headerRow, col);
    cell.font = { name: FONT, size: 11, color: { argb: INK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = borderAll;
  }

  for (let row = headerRow + 1; row <= lastRow; row += 1) {
    for (let col = 1; col <= 6; col += 1) {
      const cell = ws.getCell(row, col);
      cell.font = { name: FONT, size: 11, color: { argb: INK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PAPER } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 2 || col === 3 || col === 6 ? 'left' : 'center',
        wrapText: col === 2 || col === 3 || col === 6,
      };
      cell.border = borderAll;
    }
  }
}

function setStatusStyle(cell: ExcelJS.Cell, status: PlanStatus) {
  if (status === 'rest') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REST } };
  if (status === 'later') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LATER } };
  if (status === 'let_go') cell.font = { name: FONT, size: 11, color: { argb: INK_FAINT } };
}

function fillDay(ws: ExcelJS.Worksheet, item: PlanItem | undefined, row: number) {
  if (!item) {
    ws.getCell(row, 2).value = '这一格可以先空着';
    ws.getCell(row, 3).value = '—';
    ws.getCell(row, 4).value = '—';
    ws.getCell(row, 5).value = '已安排';
    return;
  }
  ws.getCell(row, 2).value = item.arrangement;
  ws.getCell(row, 3).value = item.planned_minutes ? formatMinutes(item.planned_minutes) : '—';
  ws.getCell(row, 4).value = item.actual_minutes ? formatMinutes(item.actual_minutes) : '0';
  ws.getCell(row, 5).value = COPY.planStatus[item.status];
  ws.getCell(row, 6).value = item.note ?? '';
  setStatusStyle(ws.getCell(row, 5), item.status);
}

function addStatusValidation(ws: ExcelJS.Worksheet, range: string) {
  const validation = `"${Object.values(COPY.planStatus).join(',')}"`;
  for (let row = Number(range.split(':')[0].slice(1)); row <= Number(range.split(':')[1].slice(1)); row += 1) {
    ws.getCell(`E${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [validation],
      showErrorMessage: false,
    };
  }
  ws.addConditionalFormatting({
    ref: range,
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text: '想缓一缓',
        priority: 1,
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: REST } } },
      },
      {
        type: 'containsText',
        operator: 'containsText',
        text: '改天再来',
        priority: 2,
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LATER } } },
      },
      {
        type: 'containsText',
        operator: 'containsText',
        text: '已放下',
        priority: 3,
        style: { font: { color: { argb: INK_FAINT } } },
      },
    ],
  });
}

export async function buildExcel(plan: Plan): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '回音谷';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const year = plan.items.find((item) => item.level === 'year' && !item.pocket);
  const month = plan.items.find((item) => item.level === 'month' && !item.pocket);
  const day = plan.items.find((item) => item.level === 'day' && !item.pocket);
  const buffer = plan.items.find((item) => item.level === 'week' && item.is_buffer);
  const now = new Date();

  // 1 这一年
  const shYear = workbook.addWorksheet('这一年', {
    properties: { tabColor: { argb: 'FFB6C6B7' } },
  });
  styleSheet(shYear, [12, 28, 34, 14, 14, 26], 3, 4);
  shYear.getCell('A1').value = EXCEL_SHEETS[0].title;
  shYear.getCell('A2').value = EXCEL_SHEETS[0].subtitle;
  EXCEL_SHEETS[0].headers.forEach((header, index) => {
    shYear.getCell(3, index + 1).value = header;
  });
  shYear.getCell('A4').value = `${now.getFullYear()} 年`;
  shYear.getCell('B4').value = year?.direction ?? plan.goal;
  shYear.getCell('C4').value = year?.arrangement ?? '';
  shYear.getCell('D4').value = `${plan.rhythm}专注，一天约 ${formatMinutes(plan.dailyMinutes)}`;
  shYear.getCell('E4').value = '每周留一格给生活';
  shYear.getCell('F4').value = year?.note ?? '年末再回来看看';

  // 2 这个月
  const shMonth = workbook.addWorksheet('这个月', {
    properties: { tabColor: { argb: 'FFC8CEB9' } },
  });
  styleSheet(shMonth, [12, 28, 34, 14, 14, 26], 3, 4);
  shMonth.getCell('A1').value = EXCEL_SHEETS[1].title;
  shMonth.getCell('A2').value = EXCEL_SHEETS[1].subtitle;
  EXCEL_SHEETS[1].headers.forEach((header, index) => {
    shMonth.getCell(3, index + 1).value = header;
  });
  shMonth.getCell('A4').value = `${now.getMonth() + 1} 月`;
  shMonth.getCell('B4').value = month?.direction ?? '';
  shMonth.getCell('C4').value = month?.arrangement ?? '';
  shMonth.getCell('D4').value = month ? formatMinutes(month.planned_minutes) : '—';
  shMonth.getCell('E4').value = '每周留一点空白';
  shMonth.getCell('F4').value = month?.note ?? '月末回看';

  // 3 这一周
  const shWeek = workbook.addWorksheet('这一周', {
    properties: { tabColor: { argb: 'FFD6D0BF' } },
  });
  styleSheet(shWeek, [12, 28, 34, 14, 14, 26], 3, 11);
  shWeek.getCell('A1').value = EXCEL_SHEETS[2].title;
  shWeek.getCell('A2').value = EXCEL_SHEETS[2].subtitle;
  EXCEL_SHEETS[2].headers.forEach((header, index) => {
    shWeek.getCell(3, index + 1).value = header;
  });
  const weekStart = fromIso(plan.weekStart);
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(weekStart, index);
    const key = isoDate(date);
    const items = plan.items.filter(
      (item) => item.level === 'week' && !item.is_buffer && !item.pocket && item.start_date === key,
    );
    shWeek.getCell(4 + index, 1).value = COPY.planWeekDays[index];
    if (items.length === 0) {
      fillDay(shWeek, undefined, 4 + index);
      shWeek.getCell(4 + index, 5).value = '';
    } else if (items.length === 1) {
      fillDay(shWeek, items[0], 4 + index);
    } else {
      shWeek.getCell(4 + index, 2).value = items.map((item) => item.arrangement).join('\n');
      shWeek.getCell(4 + index, 3).value = items
        .map((item) => (item.planned_minutes ? formatMinutes(item.planned_minutes) : '—'))
        .join('\n');
      shWeek.getCell(4 + index, 4).value = items
        .map((item) => (item.actual_minutes ? formatMinutes(item.actual_minutes) : '0'))
        .join('\n');
      shWeek.getCell(4 + index, 5).value = items.map((item) => COPY.planStatus[item.status]).join('\n');
      shWeek.getCell(4 + index, 6).value = items.map((item) => item.note ?? '').join('\n');
      setStatusStyle(shWeek.getCell(4 + index, 5), items[0].status);
    }
  }
  const bufferRow = 11;
  shWeek.getCell(bufferRow, 1).value = '留白';
  shWeek.getCell(bufferRow, 2).value = buffer?.arrangement ?? COPY.weekBufferText;
  shWeek.getCell(bufferRow, 3).value = '—';
  shWeek.getCell(bufferRow, 4).value = '—';
  shWeek.getCell(bufferRow, 5).value = '—';
  shWeek.getCell(bufferRow, 6).value = buffer?.note ?? COPY.weekBufferNote;
  for (let col = 1; col <= 6; col += 1) {
    shWeek.getCell(bufferRow, col).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BUFFER },
    };
  }
  addStatusValidation(shWeek, 'E4:E10');

  // 4 今天
  const shDay = workbook.addWorksheet('今天', {
    properties: { tabColor: { argb: 'FFDCE3D8' } },
  });
  styleSheet(shDay, [32, 14, 34, 14, 14, 26], 3, 4);
  shDay.getCell('A1').value = EXCEL_SHEETS[3].title;
  shDay.getCell('A2').value = EXCEL_SHEETS[3].subtitle;
  EXCEL_SHEETS[3].headers.forEach((header, index) => {
    shDay.getCell(3, index + 1).value = header;
  });
  shDay.getCell('A4').value = day?.arrangement ?? '';
  shDay.getCell('B4').value = day?.planned_minutes ? formatMinutes(day.planned_minutes) : '—';
  shDay.getCell('C4').value = day?.enough_point ?? '还没写';
  shDay.getCell('D4').value = day?.actual_minutes ? formatMinutes(day.actual_minutes) : '0';
  shDay.getCell('E4').value = day ? COPY.planStatus[day.status] : COPY.planStatus.planned;
  shDay.getCell('F4').value = day?.note ?? '';
  if (day) setStatusStyle(shDay.getCell('E4'), day.status);
  addStatusValidation(shDay, 'E4:E4');
  shDay.pageSetup.orientation = 'portrait';

  // 5 说明
  const shNotes = workbook.addWorksheet('说明', {
    properties: { tabColor: { argb: 'FFE7E1D4' } },
  });
  shNotes.getColumn(1).width = 22;
  for (let col = 2; col <= 6; col += 1) shNotes.getColumn(col).width = 18;
  shNotes.mergeCells('A1:F1');
  shNotes.mergeCells('A3:F34');
  shNotes.getCell('A1').value = '关于这张表';
  shNotes.getCell('A1').font = { name: FONT, size: 16, color: { argb: INK } };
  shNotes.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  shNotes.getRow(1).height = 30;
  shNotes.getCell('A3').value = EXCEL_NOTES_TXT;
  shNotes.getCell('A3').font = { name: FONT, size: 11, color: { argb: INK } };
  shNotes.getCell('A3').alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  shNotes.getRow(3).height = 420;
  shNotes.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.59, right: 0.59, top: 0.59, bottom: 0.59, header: 0.3, footer: 0.3 },
    printArea: 'A1:F34',
  };

  const bufferData = await workbook.xlsx.writeBuffer();
  return new Blob([bufferData as unknown as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
