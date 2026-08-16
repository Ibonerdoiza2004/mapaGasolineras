package com.example.gasolineras_api.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import com.example.gasolineras_api.controller.HelloController;
import com.example.gasolineras_api.service.HelloService;

@WebMvcTest(HelloController.class)
@Import(HelloService.class)
class CorsWebTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void permiteElOrigenConfigurado() throws Exception {
		mockMvc.perform(get("/api/hello").header("Origin", "http://localhost:4321"))
				.andExpect(status().isOk())
				.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4321"));
	}

	@Test
	void rechazaUnOrigenNoConfigurado() throws Exception {
		mockMvc.perform(get("/api/hello").header("Origin", "http://evil.example.com"))
				.andExpect(status().isOk())
				.andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
	}

	@Test
	void respondeALaSolicitudPreflight() throws Exception {
		mockMvc.perform(options("/api/hello")
						.header("Origin", "http://localhost:4321")
						.header("Access-Control-Request-Method", "GET"))
				.andExpect(status().isOk())
				.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4321"));
	}
}
