# YOUNHEEPARK Corp. STOCK — 의류 재고관리 V1

의류 상품의 `상품 → 컬러 → 사이즈 SKU`를 관리하는 웹 기반 내부 재고관리 도구입니다. 재고 수량은 직접 수정하지 않고, 모든 입고·출고를 `inventory_transactions` 원장에 기록한 뒤 현재고를 자동 반영합니다.

## V1 기능

- Supabase 이메일/비밀번호 관리자 로그인
- 브랜드 라벨, 상품 기본 정보, 대표 이미지, 컬러별 이미지 등록
- 컬러·사이즈별 SKU 등록 및 현재고 조회
- 상품 이미지가 포함된 반응형 재고 목록
- 브랜드별 필터 및 상품명, 품번, SKU, 컬러, 사이즈 검색
- 상품별 대여 상태 설정, 대여중 요약·필터·배지
- 입고·출고 사유와 메모 기록
- 트랜잭션 단위 현재고 자동 반영 및 재고 부족 출고 방지
- SKU별 저재고/품절 표시
- 상품 상세와 전체 입출고 원장

## 기술 구성

- Next.js App Router + TypeScript
- Supabase Auth, Postgres, Storage, Row Level Security
- 순수 CSS 기반 반응형 UI
- Next.js 정적 내보내기 + GitHub Pages 자동 배포

## 로컬 실행

Node.js 20.9 이상과 pnpm이 필요합니다.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`.env.local`에 Supabase 프로젝트의 값을 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. `supabase/migrations`의 SQL을 생성 순서대로 실행합니다. Supabase CLI를 사용한다면 프로젝트를 연결한 뒤 `supabase db push`를 실행해도 됩니다.
3. Authentication의 Users에서 내부 관리자 계정을 생성합니다.
4. 공개 회원가입은 사용하지 않고, 관리자만 Users에서 초대/생성하는 방식을 권장합니다.

마이그레이션이 함께 생성하는 항목:

- `products`, `variants`, `inventory`, `inventory_transactions`
- `product-images` Storage bucket 및 이미지 정책
- 인증 사용자용 RLS 정책
- 원장 기록과 현재고 갱신을 한 트랜잭션으로 실행하는 `register_inventory_transaction` 함수

## 재고 정합성 원칙

`inventory_transactions`가 재고의 원본 원장이고 `inventory`는 빠른 조회를 위한 현재 상태입니다. 앱에는 `inventory.quantity`를 직접 수정하는 API나 화면이 없습니다. 입고·출고는 항상 데이터베이스 함수 하나를 거치며, 해당 함수가 다음 작업을 원자적으로 처리합니다.

1. SKU의 현재고 행 잠금
2. 출고 재고 부족 검증
3. 입출고 원장 추가
4. 반영 후 재고 저장

동시에 여러 장소에서 같은 SKU를 처리해도 유실 업데이트가 발생하지 않습니다.

## GitHub Pages 배포

무료 GitHub 계정에서 Pages를 사용하려면 저장소를 Public으로 만들어야 합니다. 코드에는 데이터베이스 비밀번호나 서비스 역할 키가 포함되지 않으며, 실제 데이터 접근은 Supabase Auth와 RLS가 보호합니다.

### 1. GitHub 저장소에 올리기

```bash
git init
git add .
git commit -m "feat: build apparel inventory v1"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

### 2. GitHub Secrets 등록

GitHub 저장소에서 `Settings → Secrets and variables → Actions → New repository secret`으로 이동해 다음 두 Secret을 등록합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

두 번째 값에는 Supabase의 publishable key 또는 anon key를 사용합니다. `service_role` 키는 절대 등록하지 마세요.

### 3. Pages 활성화

GitHub 저장소에서 `Settings → Pages → Build and deployment → Source`를 `GitHub Actions`로 설정합니다. `main` 브랜치에 push하면 `Deploy GitHub Pages` 작업이 정적 사이트를 빌드해 자동 배포합니다.

일반적인 배포 주소는 다음과 같습니다.

```text
https://GITHUB_ID.github.io/REPOSITORY_NAME/
```

프로젝트는 GitHub Actions 환경에서 저장소 이름을 자동으로 감지해 Next.js의 `basePath`와 정적 자산 경로에 적용합니다. 로컬에서는 계속 `http://localhost:3000`으로 실행됩니다.

### 4. Supabase 인증 주소 설정

Supabase Dashboard의 `Authentication → URL Configuration`에서 다음처럼 설정합니다.

```text
Site URL
https://GITHUB_ID.github.io/REPOSITORY_NAME/

Redirect URLs
http://localhost:3000/**
https://GITHUB_ID.github.io/REPOSITORY_NAME/**
```

### 5. 이후 업데이트

```bash
git add .
git commit -m "feat: update inventory"
git push
```

push할 때마다 GitHub Actions가 타입 검사와 빌드를 실행하고, `main` 브랜치의 최신 버전을 Pages에 배포합니다.

> GitHub Pages 주소는 공개되어 누구나 로그인 화면까지 열 수 있습니다. 상품과 재고 데이터는 인증된 관리자만 읽고 변경할 수 있도록 Supabase RLS가 적용되어 있습니다. 관리자 계정은 Supabase Dashboard에서만 생성하세요.

## 향후 확장 지점

V1에는 포함하지 않았지만 현재 모델을 유지하면서 Cafe24 주문 연동, 다중 창고, 발주, 생산, 재고 이동, 공급처 테이블을 추가할 수 있습니다. 외부 주문 번호나 창고 위치는 원장에 연결되는 별도 도메인 테이블로 확장하고, 재고 변경은 계속 동일한 원장 함수 계층을 통과시키는 구조가 적합합니다.
