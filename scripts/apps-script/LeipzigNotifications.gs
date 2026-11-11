const LEIPZIG = {
  source: 'https://uiischedule.ueh.edu.vn/',
  campus: 'B1-1501 Co-working Space',
  roomId: 1034,
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
  console.log(JSON.stringify({ through: source.through, byStatus: counts }));
}

function startLeipzigNotifications() {
  checkLeipzigNotifications();
  stopLeipzigNotifications();
  ScriptApp.newTrigger(LEIPZIG.triggerFunction).timeBased().everyMinutes(5).create();
}

function stopLeipzigNotifications() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === LEIPZIG.triggerFunction) {
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
    const previousThrough = settings.LEIPZIG_SCANNED_THROUGH;
    const baseline = {};
    let sent = 0;
    let needsReview = 0;

    for (const booking of source.bookings) {
      if (booking.status !== Number(settings.APPROVED_STATUS)) continue;
      const key = 'LEIPZIG_BOOKING_' + booking.id;
      if (settings[key] === 'sending') needsReview++;
      if (settings[key]) continue;
      if (!previousThrough || booking.day > previousThrough) {
        baseline[key] = 'existing';
        continue;
      }
      if (!validLeipzigEmail_(booking.email)) continue;

      // Keep ambiguous sends visible for review instead of automatically sending twice.
      props.setProperty(key, 'sending');
      try {
        GmailApp.sendEmail(
          booking.email,
          'Xác nhận đặt phòng Leipzig',
          [
            'Chào bạn,',
            '',
            'Lịch đặt phòng Leipzig của bạn đã được duyệt.',
            'Tiêu đề: ' + booking.title,
            'Bắt đầu: ' + booking.start,
            'Kết thúc: ' + booking.end,
            'Giờ Việt Nam',
            '',
            'Mã đặt phòng: ' + booking.id,
            'Xem lịch: ' + LEIPZIG.source,
          ].join('\n'),
          mailOptions,
        );
      } catch {
        needsReview++;
        continue;
      }
      props.setProperty(key, 'sent');
      sent++;
    }
    baseline.LEIPZIG_SCANNED_THROUGH = source.through;
    props.setProperties(baseline);
    console.log(JSON.stringify({ sent, needsReview }));
  } finally {
    lock.releaseLock();
  }
}

function leipzigSenderOptions_(settings) {
  const active = Session.getEffectiveUser().getEmail().toLowerCase();
  if (!validLeipzigEmail_(active) || active !== (settings.SENDER_ACCOUNT || '').trim().toLowerCase()) {
    throw new Error('Tài khoản đang chạy phải trùng với SENDER_ACCOUNT.');
  }
  const options = { name: 'Phòng họp Leipzig' };
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
  const currentTime = Utilities.formatDate(now, LEIPZIG.timeZone, "yyyy-MM-dd'T'HH:mm");
  const today = currentTime.slice(0, 10);
  const end = new Date(now.getTime() + LEIPZIG.horizonDays * 86400000);
  const through = Utilities.formatDate(end, LEIPZIG.timeZone, 'yyyy-MM-dd');
  const query = [
    'from=' + encodeURIComponent(Utilities.formatDate(now, LEIPZIG.timeZone, 'MM/dd/yyyy')),
    'to=' + encodeURIComponent(Utilities.formatDate(end, LEIPZIG.timeZone, 'MM/dd/yyyy')),
    'type=week',
    'campus=' + encodeURIComponent(LEIPZIG.campus),
  ].join('&');
  const response = UrlFetchApp.fetch(LEIPZIG.source + '?' + query, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Không tải được lịch nguồn UII.');
  const match = response.getContentText().match(/const scheduleGroup\s*=\s*(\[.*\])\s*;/);
  if (!match) throw new Error('Định dạng lịch nguồn UII đã thay đổi.');
  let weeks;
  try {
    weeks = JSON.parse(match[1]);
  } catch {
    throw new Error('Dữ liệu lịch nguồn UII không hợp lệ.');
  }
  const bookings = new Map();
  const lastWeek = weeks[weeks.length - 1];
  if (!weeks.length || String(weeks[0].from).slice(0, 10) > today ||
      String(lastWeek.to).slice(0, 10) < through) {
    throw new Error('Lịch nguồn UII chưa trả đủ khoảng ngày yêu cầu.');
  }
  for (const week of weeks) {
    const room = week.roomSchedules.find(item => item.room.id === LEIPZIG.roomId);
    if (!room) throw new Error('Không tìm thấy phòng Leipzig trong lịch nguồn.');
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
          bookings.set(String(form.id), {
            id: String(form.id),
            status: form.status,
            email: String(form.email || '').trim(),
            title: String(event.title || 'Đặt phòng Leipzig'),
            day: date,
            start: leipzigDisplayTime_(start),
            end: leipzigDisplayTime_(end),
          });
        }
      }
    }
  }
  return { bookings: [...bookings.values()], through };
}

function leipzigDisplayTime_(value) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return value.slice(11, 16) + ' ngày ' + day + '/' + month + '/' + year;
}
