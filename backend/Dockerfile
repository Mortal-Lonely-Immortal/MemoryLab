FROM eclipse-temurin:17-jre

RUN groupadd --system app && useradd --system --gid app --home-dir /app app

WORKDIR /app
COPY target/memory-app-0.1.0.jar app.jar
RUN chown app:app /app/app.jar

ENV TZ=Asia/Shanghai \
    JAVA_OPTS="-Xms256m -Xmx512m"

USER app
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080'

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
