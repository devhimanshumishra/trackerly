# Setup
1. npx create-next-app@latest code-tracker --ts --tailwind --app --src-dir --eslint --no-turbopack --import-alias "@/*"
2. cd code-tracker && npm i mongoose swr react-activity-calendar
3. Is zip ke `src/` aur `public/` folders ko code-tracker ke andar copy kar (overwrite), phir .env.example ko .env.local bana ke values bhar.
4. npm run dev  ->  http://localhost:3000  (browser password maangega; username kuch bhi)
5. Production: npm run build && npm start, HTTPS wale domain pe expose kar (PWA install ke liye HTTPS chahiye).
