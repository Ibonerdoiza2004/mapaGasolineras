package com.example.gasolineras_api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.gasolineras_api.service.HelloService;

@RestController
@RequestMapping("/api/hello")
public class HelloController {

	private final HelloService helloService;

	public HelloController(HelloService helloService) {
		this.helloService = helloService;
	}

	@GetMapping
	public String hello() {
		return helloService.hello();
	}
}
