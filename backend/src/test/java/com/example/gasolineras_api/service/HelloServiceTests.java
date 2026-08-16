package com.example.gasolineras_api.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HelloServiceTests {

	private final HelloService helloService = new HelloService();

	@Test
	void helloDevuelveMensaje() {
		assertThat(helloService.hello()).isEqualTo("Hello World");
	}
}
