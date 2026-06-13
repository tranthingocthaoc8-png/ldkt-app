import './globals.css';

export const metadata = {
  title: 'Lãnh Đạo Khai Tâm 21 Ngày',
  description: 'Mobile check-in app for Leadership Challenge',
  manifest: '/manifest.json',
  themeColor: '#1A1A2E'
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
