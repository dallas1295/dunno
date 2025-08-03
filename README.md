# Current Notes

- remember nextjs-cors for routing later
- add next-auth for OAuth and Socials to be used for sign in and account creation

## Running the Application

This project uses Docker to create a consistent and isolated environment for development and production testing. You will need to have Docker and Docker Compose installed on your machine.

### Development

For day-to-day development, use the development-specific Docker Compose file. This setup enables hot-reloading, so any changes you make to the source code will be instantly reflected in the running application without needing to rebuild.

1.  **Build and Start the Containers:**
    ```bash
    docker-compose -f docker-compose.dev.yml up --build
    ```
    *(You only need to add the `--build` flag the first time you run it or after you change dependencies in `package.json`.)*

2.  **Access the Application:**
    The application will be available at [http://localhost:8080](http://localhost:8080).

### Production Testing

To test the final, optimized production build of the application, use the main `docker-compose.yml` file. This is how the application would run in a production environment.

1.  **Build and Start the Containers:**
    ```bash
    docker-compose up --build
    ```

2.  **Access the Application:**
    The application will be available at [http://localhost:8080](http://localhost:8080).
