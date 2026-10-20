import React from 'react'

/**
 * ErrorBoundary
 * 
 * Wraps each module independently. If a module throws an unhandled
 * error, only that module crashes — the rest of the app keeps running.
 * User can navigate back to the main menu.
 */

interface Props {
  children: React.ReactNode
  moduleName: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.moduleName}] Module error:`, error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '40px',
          gap: '24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <div>
            <h3 style={{ color: 'var(--accent-danger)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
              {this.props.moduleName} Modülü Hata Verdi
            </h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', fontSize: '14px' }}>
              Bu modülde beklenmeyen bir hata oluştu. Diğer modüller normal çalışmaya devam etmektedir.
            </p>
            {this.state.error && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'rgba(255,77,106,0.08)',
                borderRadius: '8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--accent-danger)',
                textAlign: 'left',
                maxWidth: '560px',
                overflow: 'auto',
                maxHeight: '120px'
              }}>
                {this.state.error.name}: {this.state.error.message}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={this.handleReset}>
              Tekrar Dene
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
