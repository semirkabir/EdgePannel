# Codebase Improvement Recommendations

## 🔴 High Priority

### 1. **Type Safety Improvements**
**Issue**: `MarketDetails.tsx` has 16+ `any` types, making the code error-prone and hard to maintain.

**Recommendation**:
- Create proper `Event` and `EventMarket` types in `types/market.ts`
- Replace all `(market as any)` casts with proper type guards
- Add discriminated unions for event vs market distinction

**Files to update**:
- `types/market.ts` - Add `Event` interface
- `components/panels/MarketDetails.tsx` - Remove all `any` types
- `hooks/use-events.ts` - Properly type event transformations

**Impact**: Prevents runtime errors, improves IDE autocomplete, makes refactoring safer

---

### 2. **Console Log Cleanup**
**Issue**: 1,673 console.log/warn/error statements across 168 files. Many should be removed or made dev-only.

**Recommendation**:
- Create a `lib/utils/logger.ts` utility that only logs in development
- Replace all `console.log` with `logger.debug()`
- Keep `console.error` for critical errors (but wrap in logger)
- Remove debug logs from production code paths

**Example**:
```typescript
// lib/utils/logger.ts
export const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args)
    }
  },
  error: (...args: any[]) => {
    console.error(...args)
    // Could also send to error tracking service
  }
}
```

**Impact**: Cleaner production logs, better performance, easier debugging

---

### 3. **Performance Optimization - Large Data Transformations**
**Issue**: `use-events.ts` uses nested `flatMap` + `map` which can be slow with large datasets.

**Recommendation**:
- Use `useMemo` to memoize the transformation
- Consider using `useDeferredValue` for non-critical updates
- Add pagination/virtualization for large event lists

**Current**:
```typescript
const markets: Market[] = events
  ? events.flatMap((event) => {
      return event.markets.map((market: any) => {
        // transformation
      })
    })
  : []
```

**Improved**:
```typescript
const markets: Market[] = useMemo(() => {
  if (!events) return []
  return events.flatMap((event) => {
    if (!event.markets?.length) return []
    return event.markets.map(transformMarket)
  })
}, [events])
```

**Impact**: Better performance with large datasets, smoother UI

---

## 🟡 Medium Priority

### 4. **Error Boundary Coverage**
**Issue**: Error boundaries exist but may not cover all critical paths.

**Recommendation**:
- Wrap `MarketDetails` component in error boundary
- Add error boundaries around data-fetching hooks
- Create specialized error boundaries for API failures

**Files to update**:
- `components/panels/MarketDetails.tsx` - Wrap in error boundary
- `components/edge/EdgeMap.tsx` - Add error boundary

**Impact**: Better user experience when errors occur, prevents full app crashes

---

### 5. **Code Duplication - Market Transformation**
**Issue**: Market transformation logic is duplicated across multiple files.

**Recommendation**:
- Create a centralized `lib/markets/transform.ts` utility
- Extract common transformation patterns
- Use shared utilities in `use-events.ts`, `kalshi-optimized.ts`, etc.

**Impact**: Easier maintenance, consistent data structure, fewer bugs

---

### 6. **TODO Comments**
**Issue**: Several TODO comments indicate incomplete features.

**Found TODOs**:
- `lib/notifications/whale-notification-dispatcher.ts:154` - Navigate to market details
- `app/dashboard/portfolio/page.tsx:21` - Get from user session/settings
- `hooks/use-search.ts:168` - Implement pagination

**Recommendation**: Prioritize and complete or remove stale TODOs.

---

## 🟢 Low Priority (Nice to Have)

### 7. **Bundle Size Optimization**
**Recommendation**:
- Run `npm run build` and analyze bundle size
- Check for unused dependencies
- Consider code splitting for large components (PolyglobeMap, MarketDetails)

**Tools**: `@next/bundle-analyzer`, `webpack-bundle-analyzer`

---

### 8. **Testing Infrastructure**
**Recommendation**:
- Add unit tests for critical utilities (`lib/markets/enrich.ts`)
- Add integration tests for API routes
- Add E2E tests for key user flows (market selection, filtering)

**Framework**: Jest + React Testing Library + Playwright

---

### 9. **Documentation**
**Recommendation**:
- Add JSDoc comments to complex functions
- Document API route parameters and responses
- Create architecture diagrams for complex flows

---

### 10. **Accessibility (A11y)**
**Recommendation**:
- Add ARIA labels to interactive elements
- Ensure keyboard navigation works
- Test with screen readers
- Add focus indicators

---

## 📊 Quick Wins (Can Do Now)

1. **Create Event Type** (15 min)
   - Add `Event` interface to `types/market.ts`
   - Update `MarketDetails.tsx` to use it

2. **Logger Utility** (20 min)
   - Create `lib/utils/logger.ts`
   - Replace 5-10 most common console.logs

3. **Memoize Event Transformation** (10 min)
   - Wrap `use-events.ts` transformation in `useMemo`

4. **Remove Stale TODOs** (5 min)
   - Review and remove/complete TODOs

---

## 🎯 Recommended Order

1. **Type Safety** (prevents bugs, improves DX)
2. **Logger Utility** (quick win, immediate benefit)
3. **Performance Optimization** (better UX)
4. **Error Boundaries** (better error handling)
5. **Code Deduplication** (maintainability)

---

## 📝 Notes

- All changes should maintain backward compatibility
- Test thoroughly after each improvement
- Consider creating feature flags for major changes
- Document breaking changes if any
