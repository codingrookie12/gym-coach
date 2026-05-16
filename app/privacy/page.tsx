export const metadata = {
  title: 'Privacy Policy — Gym Coach',
}

export default function PrivacyPage() {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={h1Style}>Privacy Policy</h1>
        <p style={metaStyle}>Effective date: May 16, 2026 · Ley 1581 de 2012</p>

        <Section title="Who we are">
          <p>Gym Coach is a personal fitness tracking application operated by Johnatan Sanchez (the "Controller"). Contact: <a href="mailto:sanchez92.j@gmail.com" style={linkStyle}>sanchez92.j@gmail.com</a></p>
        </Section>

        <Section title="What we collect">
          <p>When you sign in and use the app, we collect:</p>
          <ul style={listStyle}>
            <li>Your email address and display name (from Google or your email provider)</li>
            <li>Workout records you create: exercise names, sets, reps, weights, and dates</li>
            <li>The training program you select</li>
          </ul>
          <p>We do not collect payment information, location data, or any health metrics beyond what you manually enter.</p>
        </Section>

        <Section title="How we use it">
          <p>Your data is used solely to provide the app: show your workout history, track progress, and remember your program. We do not sell, share, or use your data for advertising.</p>
        </Section>

        <Section title="Where it's stored">
          <p>Data is stored in Supabase (Postgres), hosted in the United States. Access is restricted to your own account via row-level security policies — no other user can read your data.</p>
        </Section>

        <Section title="Your rights (Ley 1581)">
          <p>Under Colombian data protection law you may at any time:</p>
          <ul style={listStyle}>
            <li><strong>Access</strong> — request a copy of all data we hold about you</li>
            <li><strong>Correct</strong> — ask us to fix inaccurate data</li>
            <li><strong>Delete</strong> — request deletion of your account and all associated data</li>
            <li><strong>Withdraw consent</strong> — stop using the app; your data will be deleted on request</li>
          </ul>
          <p>To exercise these rights, email <a href="mailto:sanchez92.j@gmail.com" style={linkStyle}>sanchez92.j@gmail.com</a>. We will respond within 10 business days.</p>
        </Section>

        <Section title="Terms of use">
          <p>Gym Coach is provided as-is for personal fitness tracking. You may use it only for lawful, personal purposes. We make no warranties about availability or accuracy of coaching suggestions. We may discontinue the service at any time with reasonable notice.</p>
        </Section>

        <Section title="Changes">
          <p>If we materially change how we handle your data, we will update this page and display a notice in the app before the change takes effect.</p>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>{title}</h2>
      <div style={bodyStyle}>{children}</div>
    </section>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: '#0C0B09',
  color: '#E8E4DC',
  padding: '48px 20px 80px',
}

const containerStyle: React.CSSProperties = {
  maxWidth: '640px',
  margin: '0 auto',
}

const h1Style: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: '2rem',
  letterSpacing: '0.08em',
  color: '#E8E4DC',
  marginBottom: '6px',
}

const metaStyle: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace",
  fontSize: '0.65rem',
  color: '#888',
  letterSpacing: '0.05em',
  marginBottom: '40px',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '32px',
}

const h2Style: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: '1rem',
  letterSpacing: '0.12em',
  color: '#C5A35A',
  marginBottom: '10px',
  textTransform: 'uppercase',
}

const bodyStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '0.95rem',
  lineHeight: 1.65,
  color: '#B0A898',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const listStyle: React.CSSProperties = {
  paddingLeft: '18px',
  margin: 0,
}

const linkStyle: React.CSSProperties = {
  color: '#C5A35A',
  textDecoration: 'none',
}
