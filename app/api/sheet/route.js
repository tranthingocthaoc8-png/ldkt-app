const SHEET_API_URL =
  'https://script.google.com/macros/s/AKfycbwXSN2IzDrARnWm7rXOnFqqiKiO6xZynK4yVCtvkqHtWgI59M7bnIlrbNGhhP-McoUzIw/exec';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(SHEET_API_URL, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow'
    });

    const text = await res.text();

    return new Response(text, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.text();

    const res = await fetch(SHEET_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain;charset=utf-8'
      },
      body,
      redirect: 'follow'
    });

    const text = await res.text();

    return new Response(text, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
