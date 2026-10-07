# Toys API

REST API for a toy catalog. Built with Node.js, Express and MongoDB/Mongoose. It includes Joi validation, bcrypt password hashing, JWT authentication, ownership checks, pagination and safe environment-variable handling.

## Setup

```bash
npm install
copy .env.example .env
# Set MONGODB_URI and JWT_SECRET in .env
npm run seed
npm start
```

The default local URL is `http://localhost:3001`.

Never commit `.env` or `node_modules`.

## Authentication

Register with `POST /users`:

```json
{ "name": "Lidor", "email": "lidor@example.com", "password": "SecurePass123!" }
```

Log in with `POST /users/login`:

```json
{ "email": "lidor@example.com", "password": "SecurePass123!" }
```

Login returns a JWT. Send it in `x-api-key` for protected requests:

```text
x-api-key: <token>
```

## Routes

| Method | Route | Description | Auth |
| --- | --- | --- | --- |
| GET | `/` | Health check | No |
| POST | `/users` | Register a user | No |
| POST | `/users/login` | Log in and receive JWT | No |
| GET | `/toys?skip=0&s=robot&category=building` | List/search/filter toys, 10 per page | No |
| GET | `/toys/search?s=robot&skip=0` | Search name or description | No |
| GET | `/toys/category/:catname?skip=0` | List one category | No |
| GET | `/toys/prices?min=10&max=40&skip=0` | Filter price range | No |
| GET | `/toys/count` | Total toy count | No |
| GET | `/toys/single/:id` | One toy by ID | No |
| POST | `/toys` | Create toy | Yes |
| PUT | `/toys/:id` | Update own toy (or any toy as ADMIN) | Yes |
| DELETE | `/toys/:id` | Delete own toy (or any toy as ADMIN) | Yes |

### Create or update toy body

```json
{
  "name": "Robot Kit",
  "info": "Buildable robot with gears.",
  "category": "building",
  "img_url": "https://example.com/robot.jpg",
  "price": 140
}
```

## Deployment to Vercel

Add these variables in the Vercel project settings before deployment:

- `MONGODB_URI`
- `JWT_SECRET` (a long random value)
- `JWT_EXPIRES_IN` (optional, defaults to `7d`)

The repository includes `vercel.json` for serverless deployment.
