const UII = {
  source: 'https://uiischedule.ueh.edu.vn/',
  campuses: [
    {
      name: 'B1-1501 Co-working Space',
      cursor: 'LEIPZIG_SCANNED_THROUGH',
      rooms: { 1034: 'Leipzig' },
    },
    {
      name: 'V - 232/6 Vo Thi Sau',
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
    '[Thử nghiệm] Xác nhận đặt phòng UII',
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
  GmailApp.sendEmail(booking.email, '[Thử nghiệm UII] Đặt phòng ' + booking.room + ' thành công',
    leipzigEmailBody_(booking), options);
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
        GmailApp.sendEmail(
          booking.email,
          'Đặt phòng ' + booking.room + ' thành công',
          leipzigEmailBody_(booking),
          mailOptions,
        );
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

function leipzigEmailBody_(booking) {
  return [
    'Chào bạn,',
    '',
    'Lịch đặt phòng của bạn đã được duyệt.',
    'Phòng: ' + booking.room,
    'Tiêu đề: ' + booking.title,
    'Bắt đầu: ' + booking.start,
    'Kết thúc: ' + booking.end,
    'Giờ Việt Nam',
    '',
    'Mã đặt phòng: ' + booking.id,
    'Xem lịch: ' + UII.source,
  ].join('\n');
}

function leipzigSenderOptions_(settings) {
  const active = Session.getEffectiveUser().getEmail().toLowerCase();
  if (!validLeipzigEmail_(active) || active !== (settings.SENDER_ACCOUNT || '').trim().toLowerCase()) {
    throw new Error('Tài khoản đang chạy phải trùng với SENDER_ACCOUNT.');
  }
  const options = { name: 'Đặt phòng UII' };
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
              status: form.status,
              email: String(form.email || '').trim(),
              title: String(event.title || 'Đặt phòng ' + roomName),
              day: date,
              start: leipzigDisplayTime_(start),
              end: leipzigDisplayTime_(end),
            });
          }
        }
      }
    }
  }
  return bookings;
}

function leipzigDisplayTime_(value) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return value.slice(11, 16) + ' ngày ' + day + '/' + month + '/' + year;
}
