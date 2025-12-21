import { render, screen } from './utils/test-utils'
import '@testing-library/jest-dom'

describe('Example Test', () => {
    it('renders a heading', () => {
        render(<h1>Hello World</h1>)
        const heading = screen.getByRole('heading', { level: 1, name: /hello world/i })
        expect(heading).toBeInTheDocument()
    })
})
