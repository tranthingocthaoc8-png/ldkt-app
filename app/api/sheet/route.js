const SHEET_API_URL =
  'https://script.google.com/macros/s/AKfycbwXSN2IzDrARnWm7rXOnFqqiKiO6xZynK4yVCtvkqHtWgI59M7bnIlrbNGhhP-McoUzIw/exec';

export async function GET() {
  const res = await fetch(SHEET_API_URL, { cache: 'no-store' });
  const text = await res.text();

  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export async function POST(request) {
  const body = await request.text();

  const res = await fetch(SHEET_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body
  });

  const text = await res.text();

  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
