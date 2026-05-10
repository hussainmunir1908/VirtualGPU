import './globals.css';

export const metadata = {
  title: 'VirtualGPU — GPU Architecture Simulator',
  description: 'Real-time GPU simulation for Computer Architecture — CS361',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
