```markdown
# nest-js_procesos 🚀

This project is a backend application built with NestJS and TypeScript, designed to automate various processes and integrations. It leverages a range of Node.js libraries and NestJS modules to handle tasks such as email fetching (IMAP), file processing (zipping, archiving, Excel generation), data transfer (Axios), charting, and database interactions (TypeORM with MSSQL).

## Features

*   **Email Automation:** Fetch emails from IMAP servers for automated processing.
*   **File Manipulation:** Create and extract ZIP archives, generate Excel files.
*   **Data Integration:** Use Axios for making HTTP requests to external APIs.
*   **Scheduling:** Schedule recurring tasks using NestJS Schedule.
*   **WebSockets:** Real-time communication capabilities.
*   **Database Support:** Integrated with TypeORM for data persistence, with specific support for MSSQL.
*   **Configuration Management:** Utilizes NestJS Config for managing environment variables.
*   **Chrome Profile Management:** Includes a `chrome_profile_ivr_reminder` directory, suggesting potential integration with Chrome browser automation or profile handling.
*   **Testing:** Includes unit tests for core components.

## Tech Stack

*   **Framework:** NestJS
*   **Language:** TypeScript, JavaScript
*   **Node.js Core:** @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/platform-express, @nestjs/platform-socket.io, @nestjs/schedule, @nestjs/typeorm, @nestjs/websockets
*   **File Handling:** adm-zip, archiver, exceljs
*   **HTTP Client:** axios
*   **Email Client:** imap-simple, @types/imap-simple
*   **Date/Time:** moment-timezone
*   **Database:** mssql, @nestjs/typeorm
*   **File Uploads:** multer, @types/multer
*   **Charting:** chart.js
*   **Environment Variables:** dotenv
*   **Development Tools:** ESLint, TypeScript

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd nest-js_procesos
    ```

2.  **Install Node.js dependencies:**
    This project uses `npm` as the package manager.
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root of the project and populate it with your specific configuration. Refer to the `Configuration` section for details.

4.  **Database Setup:**
    Ensure you have a MSSQL database instance running and accessible. Configure your database connection details in the `.env` file.

5.  **Initial Setup Scripts:**
    The project includes a batch script `INICIAR-BACK-FRONT.bat` which might be useful for starting both backend and frontend applications. Review its contents to understand its execution.

## Usage

### Running the Development Server

To start the NestJS development server:

```bash
npm run start:dev
```

This will launch the application in development mode, with hot-reloading enabled.

### Running the Production Build

To build the application for production:

```bash
npm run build
```

To start the production server:

```bash
npm run start:prod
```

### Testing IMAP Connection (Example)

The `test-groupwise.js` script provides a basic example of how to connect to an IMAP server. You can adapt and run this script to test your IMAP connection configurations.

**To run the test script:**

```bash
node test-groupwise.js
```

*Note: Ensure your `.env` file contains the correct IMAP credentials or manually update the `config` object within `test-groupwise.js`.*

## Project Structure

The project follows a standard NestJS structure with additional directories for specific functionalities and assets:

```
.
├── apps/                      # NestJS application(s)
│   └── nest-js_procesos/      # Main NestJS application
│       ├── src/               # Application source code
│       │   ├── app.controller.spec.ts
│       │   ├── app.controller.ts
│       │   ├── app.module.ts
│       │   └── app.service.ts
│       └── ...
├── chrome_profile_ivr_reminder/ # Chrome browser profile files (likely for automation)
├── Descargas/                 # Potential directory for downloads
├── eslint.config.mjs          # ESLint configuration
├── INICIAR-BACK-FRONT.bat     # Batch script for starting backend and frontend
├── logs/                      # Application logs (e.g., PM2 logs)
├── Logs_Automatizacion/       # Logs for specific automation processes
├── nest-cli.json              # NestJS CLI configuration
├── nginx-1.30.1/              # Nginx web server files
├── package-lock.json          # npm package lock file
├── package.json               # npm project metadata and dependencies
├── phishing_registros.db      # Potential SQLite database file
├── phishing_registros.json    # Potential JSON data file
├── README.md                  # This README file
├── temp/                      # Temporary files directory
├── temp_downloads/            # Temporary downloads directory
├── test-groupwise.js          # Script for testing IMAP connection
├── tsconfig.build.json        # TypeScript configuration for builds
└── tsconfig.json              # TypeScript configuration
```

## Configuration

This project uses environment variables for configuration, managed by `@nestjs/config` and `dotenv`. A `.env` file in the root directory should contain the following essential variables:

*   **Database Configuration (MSSQL):**
    *   `DB_HOST`: Database host address (e.g., `localhost`, `192.168.x.x`)
    *   `DB_PORT`: Database port (default: `1433`)
    *   `DB_USERNAME`: Database username
    *   `DB_PASSWORD`: Database password
    *   `DB_DATABASE`: Database name
    *   `DB_SYNCHRONIZE`: Set to `true` for auto-syncing schemas (use with caution in production)

*   **IMAP Server Configuration:**
    *   `IMAP_HOST`: IMAP server host
    *   `IMAP_PORT`: IMAP server port (usually `143` for non-TLS, `993` for TLS)
    *   `IMAP_USERNAME`: IMAP username
    *   `IMAP_PASSWORD`: IMAP password
    *   `IMAP_TLS`: Set to `true` or `false`

*   **Other Potential Variables:**
    *   `PORT`: The port on which the NestJS application will listen (default: `3000`)
    *   `JWT_SECRET`: Secret key for JWT authentication (if used)
    *   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, etc.: For cloud storage integrations (if applicable)

**Example `.env` file:**

```dotenv
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
DB_DATABASE=your_database_name
DB_SYNCHRONIZE=false # Or true for development

IMAP_HOST=192.168.8.201
IMAP_PORT=143
IMAP_USERNAME=sistemas3
IMAP_PASSWORD=As3c0n2026i#
IMAP_TLS=false

PORT=3000
```

## Contributing

*(This section can be expanded if you have specific contribution guidelines. For now, it's a placeholder.)*

We welcome contributions to `nest-js_procesos`! Please follow these guidelines:

1.  **Fork the repository.**
2.  **Create a new branch** for your feature or bug fix.
3.  **Make your changes** and ensure they are well-tested.
4.  **Submit a Pull Request** with a clear description of your changes.

## License

*(Replace with your actual license information. The following is a placeholder for MIT License.)*

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
```