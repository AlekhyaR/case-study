function success(data) {
  return { ok: true, data, timestamp: new Date().toISOString() };
}

function paginated(data, pagination) {
  return { ok: true, data, pagination, timestamp: new Date().toISOString() };
}

module.exports = { success, paginated };
