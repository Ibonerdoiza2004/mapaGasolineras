package com.example.gasolineras_api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/**
 * Habilita las tareas programadas ({@code @Scheduled}) de la aplicación.
 * El scheduler usa hilos daemon para no impedir la salida limpia de la JVM.
 */
@Configuration
@EnableScheduling
public class SchedulerConfig {

	@Bean
	public ThreadPoolTaskScheduler taskScheduler() {
		ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
		scheduler.setPoolSize(1);
		scheduler.setThreadNamePrefix("import-scheduler-");
		scheduler.setThreadFactory(runnable -> {
			Thread thread = new Thread(runnable);
			thread.setDaemon(true);
			return thread;
		});
		return scheduler;
	}
}
