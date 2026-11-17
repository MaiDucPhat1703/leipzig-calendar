const UII = {
  source: 'https://uiischedule.ueh.edu.vn/',
  campuses: [
    {
      name: 'B1-1501 Co-working Space',
      address: 'Lầu 15, 279 Nguyễn Tri Phương, Phường Diên Hồng, Thành phố Hồ Chí Minh',
      mapQuery: '279 Nguyễn Tri Phương, Phường Diên Hồng, Thành phố Hồ Chí Minh',
      cursor: 'LEIPZIG_SCANNED_THROUGH',
      rooms: { 1034: 'Leipzig' },
    },
    {
      name: 'V - 232/6 Vo Thi Sau',
      address: '232/6 Võ Thị Sáu, Phường Xuân Hòa, TP. Hồ Chí Minh',
      cursor: 'V_ROOMS_SCANNED_THROUGH',
      rooms: {
        26: 'V051 - Collaboration',
        27: 'V052 - Exploration',
        28: 'V053 - Trust',
        29: 'V054 - Inspiration',
      },
    },
  ],
  timeZone: 'Asia/Ho_Chi_Minh',
  horizonDays: 120,
  triggerFunction: 'checkLeipzigNotifications',
};

function previewLeipzigNotifications() {
  const source = fetchLeipzigBookings_();
  const counts = {};
  for (const booking of source.bookings) {
    const status = String(booking.status);
    counts[status] = (counts[status] || 0) + 1;
  }
  console.log(JSON.stringify({ through: source.through, byStatus: counts, campusesChecked: source.cursors.length, sourceErrors: source.errors }));
}

function sendLeipzigTestEmail() {
  const settings = PropertiesService.getScriptProperties().getProperties();
  const options = leipzigSenderOptions_(settings);
  const recipient = Session.getEffectiveUser().getEmail();
  GmailApp.sendEmail(
    recipient,
    '[Thử nghiệm] Xác nhận đặt phòng USI',
    'Đây là thư thử để kiểm tra địa chỉ gửi. Chưa có thông báo nào được gửi đến người đặt phòng.',
    options,
  );
}

function inspectLeipzigTestBooking() {
  const settings = PropertiesService.getScriptProperties().getProperties();
  const booking = findLeipzigTestBooking_(settings);
  console.log(JSON.stringify(booking ? {
    visible: true, id: booking.id, room: booking.room, status: booking.status,
  } : { visible: false }));
}

function sendLeipzigBookingTestEmail() {
  const settings = PropertiesService.getScriptProperties().getProperties();
  const options = leipzigSenderOptions_(settings);
  const booking = findLeipzigTestBooking_(settings);
  if (!booking || !/^\d+$/.test(settings.APPROVED_STATUS || '') ||
      booking.status !== Number(settings.APPROVED_STATUS)) {
    throw new Error('Lượt thử chưa xuất hiện với mã đã duyệt được cấu hình.');
  }
  const active = Session.getEffectiveUser().getEmail().toLowerCase();
  if (booking.email.toLowerCase() !== active) {
    throw new Error('Email trên form thử phải trùng với tài khoản đang chạy để thư chỉ gửi về bạn.');
  }
  sendUiiBookingEmail_(booking, options, '[Thử nghiệm] ');
}

function findLeipzigTestBooking_(settings) {
  const title = (settings.TEST_BOOKING_TITLE || '').trim();
  if (!title) throw new Error('Hãy đặt TEST_BOOKING_TITLE đúng với tiêu đề lượt thử trên UII.');
  const matches = fetchLeipzigBookings_().bookings.filter(booking => booking.title.trim() === title);
  if (matches.length > 1) throw new Error('Có nhiều lượt cùng tiêu đề; hãy dùng một tiêu đề thử riêng.');
  return matches[0];
}

function startLeipzigNotifications() {
  checkLeipzigNotifications();
  stopLeipzigNotifications();
  ScriptApp.newTrigger(UII.triggerFunction).timeBased().everyMinutes(5).create();
}

function stopLeipzigNotifications() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === UII.triggerFunction) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

function checkLeipzigNotifications() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const settings = props.getProperties();
    if (settings.NOTIFICATIONS_ENABLED !== 'true' || !/^\d+$/.test(settings.APPROVED_STATUS || '')) {
      throw new Error('Chưa bật gửi mail hoặc chưa xác nhận mã trạng thái đã duyệt.');
    }

    const mailOptions = leipzigSenderOptions_(settings);
    const source = fetchLeipzigBookings_();
    const baseline = {};
    let sent = 0;
    let existing = 0;
    let missingEmail = 0;
    let needsReview = 0;

    for (const booking of source.bookings) {
      if (booking.status !== Number(settings.APPROVED_STATUS)) continue;
      const key = 'LEIPZIG_BOOKING_' + booking.id;
      if (settings[key] === 'sending') needsReview++;
      if (settings[key]) continue;
      const previousThrough = settings[booking.cursor];
      if (!previousThrough || booking.day > previousThrough) {
        baseline[key] = 'existing';
        existing++;
        continue;
      }
      if (!validLeipzigEmail_(booking.email)) {
        missingEmail++;
        continue;
      }

      // Keep ambiguous sends visible for review instead of automatically sending twice.
      props.setProperty(key, 'sending');
      try {
        sendUiiBookingEmail_(booking, mailOptions);
      } catch {
        needsReview++;
        continue;
      }
      props.setProperty(key, 'sent');
      sent++;
    }
    for (const cursor of source.cursors) baseline[cursor] = source.through;
    props.setProperties(baseline);
    console.log(JSON.stringify({ sent, existing, missingEmail, needsReview, sourceErrors: source.errors }));
  } finally {
    lock.releaseLock();
  }
}

function sendUiiBookingEmail_(booking, options, subjectPrefix = '') {
  const startDate = uiiDisplayDate_(booking.day);
  const endDay = booking.end.slice(0, 10);
  const startTime = booking.start.slice(11, 16);
  const endTime = booking.end.slice(11, 16);
  const time = booking.day === endDay
    ? startTime + '-' + endTime + ', ngày ' + startDate
    : startTime + ' ngày ' + startDate + ' đến ' + endTime + ' ngày ' + uiiDisplayDate_(endDay);
  const fields = [
    ['Phòng', booking.room],
    ['Địa chỉ', booking.address, booking.mapQuery],
    ['Thời gian', time],
    ['Nội dung', booking.title.replaceAll('\u2013', '-')],
  ];
  const subject = subjectPrefix + '[USI] Xác nhận đặt phòng ' +
    booking.room.split(' - ')[0] + ' ngày ' + startDate;
  const approval = 'Lịch đặt phòng của bạn đã được duyệt.';
  const instruction = 'Bạn có thể sử dụng phòng theo thông tin bên dưới:';
  const signature = 'Vườn ươm Khởi nghiệp Viện Đổi mới sáng tạo.';
  const textBody = [
    'Chào bạn,',
    '',
    approval + ' ' + instruction,
    '',
    ...fields.map(([label, value]) => label + ': ' + value),
    '',
    'Xem lịch trên USI: ' + UII.source,
    '',
    'Trân trọng,',
    signature,
  ].join('\n');
  const rows = fields.map(([label, value, mapQuery]) => {
    const text = escapeUiiEmailHtml_(value);
    const display = mapQuery
      ? '<a href="https://www.google.com/maps/search/?api=1&amp;query=' + encodeURIComponent(mapQuery) +
        '" style="color:#1155cc;text-decoration:underline">' + text + '</a>'
      : text;
    return '<tr><td style="padding:0 0 10px;overflow-wrap:anywhere"><strong>' +
      label + ':</strong> ' + display + '</td></tr>';
  }).join('');
  const htmlBody = [
    '<div lang="vi" style="max-width:600px;margin:0 auto;padding:16px;color:#1b2b28;font:16px/1.55 Arial,sans-serif">',
    '<p style="margin:0 0 16px">Chào bạn,</p>',
    '<p style="margin:0 0 16px"><strong>' + approval + '</strong> ' + instruction + '</p>',
    '<table role="presentation" width="100%" style="background:#eaf5ef;border-radius:8px"><tr><td style="padding:16px 16px 6px">',
    '<table role="presentation" width="100%" style="font:inherit">' + rows + '</table></td></tr></table>',
    '<p style="margin:20px 0"><a href="' + UII.source + '" style="display:inline-block;padding:10px 16px;background:#123c37;color:#fff;border-radius:6px;font-weight:bold;text-decoration:none">Xem lịch trên USI</a></p>',
    '<p style="margin:0">Trân trọng,<br><strong>' + signature + '</strong></p>',
    '</div>',
  ].join('');
  GmailApp.sendEmail(booking.email, subject, textBody, { ...options, htmlBody });
}

function escapeUiiEmailHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function leipzigSenderOptions_(settings) {
  const active = Session.getEffectiveUser().getEmail().toLowerCase();
  if (!validLeipzigEmail_(active) || active !== (settings.SENDER_ACCOUNT || '').trim().toLowerCase()) {
    throw new Error('Tài khoản đang chạy phải trùng với SENDER_ACCOUNT.');
  }
  const options = { name: 'Đặt phòng USI' };
  const sender = (settings.SENDER_FROM || '').trim();
  if (sender && sender.toLowerCase() !== active) {
    const alias = GmailApp.getAliases().find(address => address.toLowerCase() === sender.toLowerCase());
    if (!alias) throw new Error('SENDER_FROM phải là địa chỉ Gửi thư bằng của tài khoản Gmail.');
    options.from = alias;
  }
  return options;
}

function validLeipzigEmail_(email) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
}

function fetchLeipzigBookings_() {
  const now = new Date();
  const currentTime = Utilities.formatDate(now, UII.timeZone, "yyyy-MM-dd'T'HH:mm");
  const today = currentTime.slice(0, 10);
  const end = new Date(now.getTime() + UII.horizonDays * 86400000);
  const through = Utilities.formatDate(end, UII.timeZone, 'yyyy-MM-dd');
  const query = [
    'from=' + encodeURIComponent(Utilities.formatDate(now, UII.timeZone, 'MM/dd/yyyy')),
    'to=' + encodeURIComponent(Utilities.formatDate(end, UII.timeZone, 'MM/dd/yyyy')),
    'type=week',
  ].join('&');
  const bookings = new Map();
  const cursors = [];
  const errors = [];

  for (const campus of UII.campuses) {
    try {
      const campusBookings = fetchUiiCampusBookings_(campus, query, today, through, currentTime);
      for (const booking of campusBookings) bookings.set(booking.id, booking);
      cursors.push(campus.cursor);
    } catch (error) {
      errors.push(campus.name + ' — ' + error.message);
    }
  }
  if (!cursors.length) throw new Error(errors.join(' | '));
  return { bookings: [...bookings.values()], through, cursors, errors };
}

function fetchUiiCampusBookings_(campus, query, today, through, currentTime) {
  const url = UII.source + '?' + query + '&campus=' + encodeURIComponent(campus.name);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error('Không tải được lịch nguồn UII (HTTP ' + response.getResponseCode() + ').');
  }
  const match = response.getContentText().match(/const scheduleGroup\s*=\s*(\[.*\])\s*;/);
  if (!match) throw new Error('Định dạng lịch nguồn UII đã thay đổi.');
  let weeks;
  try {
    weeks = JSON.parse(match[1]);
  } catch {
    throw new Error('Dữ liệu lịch nguồn UII không hợp lệ.');
  }
  const lastWeek = weeks[weeks.length - 1];
  if (!weeks.length || String(weeks[0].from).slice(0, 10) > today ||
      String(lastWeek.to).slice(0, 10) < through) {
    throw new Error('Lịch nguồn UII chưa trả đủ khoảng ngày yêu cầu.');
  }
  const bookings = [];
  for (const week of weeks) {
    for (const [roomId, roomName] of Object.entries(campus.rooms)) {
      const room = week.roomSchedules.find(item => String(item.room.id) === roomId);
      if (!room) throw new Error('Không tìm thấy phòng ' + roomName + ' trong lịch nguồn.');
      for (const day of room.schedules) {
        for (const slot of ['morningSchedules', 'afternoonSchedules', 'nightSchedules']) {
          for (const event of day[slot]) {
            const form = event.approveForm;
            const start = String(event.from);
            const end = String(event.to);
            const date = start.slice(0, 10);
            if (!form || String(event.approveFormId) !== String(form.id) ||
                !/^\d+$/.test(String(form.id)) || date < today || date > through ||
                !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(start) ||
                !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(end) ||
                end.slice(0, 16) <= currentTime) continue;
            bookings.push({
              id: String(form.id),
              cursor: campus.cursor,
              room: roomName,
              address: campus.address,
              mapQuery: campus.mapQuery,
              status: form.status,
              email: String(form.email || '').trim(),
              title: String(event.title || 'Đặt phòng ' + roomName),
              day: date,
              start,
              end,
            });
          }
        }
      }
    }
  }
  return bookings;
}

function uiiDisplayDate_(value) {
  const [year, month, day] = value.split('-');
  return day + '/' + month + '/' + year;
}
