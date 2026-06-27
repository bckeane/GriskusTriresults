const KEY = 'griskus_pin';

export function loadPin() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function savePin(firstName, lastName) {
  if (!firstName?.trim() || !lastName?.trim()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ firstName, lastName, claimId: null }));
  } catch {
    // QuotaExceededError — storage full, silently no-op
  }
}

export function clearPin() {
  localStorage.removeItem(KEY);
}

export function pinMatches(pin, firstName, lastName) {
  if (!pin) return false;
  return (
    pin.firstName.toLowerCase() === firstName.toLowerCase() &&
    pin.lastName.toLowerCase() === lastName.toLowerCase()
  );
}
