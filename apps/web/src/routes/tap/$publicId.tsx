import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/tap/$publicId')({
  component: OpenTapAction,
})

function OpenTapAction() {
  const { publicId } = Route.useParams()
  const valid = /^[a-f0-9]{32}$/.test(publicId)
  const appUrl = valid ? `beegreat://tap/${publicId}` : 'beegreat://'

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#f9f9f9',
        color: '#202020',
        fontFamily: 'Inter, ui-sans-serif, -apple-system, system-ui, sans-serif',
      }}
    >
      <section
        style={{
          width: 'min(100%, 420px)',
          display: 'grid',
          gap: 16,
          padding: 24,
          border: '1px solid #d8d8d8',
          borderRadius: 18,
          background: '#fcfcfc',
          textAlign: 'center',
        }}
      >
        <img
          src="/logo.png"
          width="72"
          height="72"
          alt="BeeGreat"
          style={{ justifySelf: 'center', borderRadius: 18 }}
        />
        <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.25 }}>
          Open your tap action
        </h1>
        <p style={{ margin: 0, color: '#646464', lineHeight: 1.5 }}>
          {valid
            ? 'Continue in BeeGreat to run the action registered to this NFC tag.'
            : 'This NFC tap-action link is not valid.'}
        </p>
        {valid ? (
          <a
            href={appUrl}
            style={{
              minHeight: 48,
              display: 'grid',
              placeItems: 'center',
              padding: '0 20px',
              borderRadius: 999,
              background: '#644a40',
              color: '#ffffff',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Open BeeGreat
          </a>
        ) : null}
      </section>
    </main>
  )
}
