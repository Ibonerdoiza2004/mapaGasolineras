package com.example.gasolineras_api.exception;

import com.example.gasolineras_api.client.GeocodeClientException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

/**
 * Convierte excepciones en respuestas de error con formato {@link ApiError}.
 * No expone stack traces ni detalles internos.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(InvalidParameterException.class)
	public ResponseEntity<ApiError> handleInvalidParameter(InvalidParameterException e) {
		ApiError error = new ApiError(
				"INVALID_PARAMETER",
				e.getMessage(),
				Map.of(e.getParameter(), e.getMessage())
		);
		return ResponseEntity.badRequest().body(error);
	}

	@ExceptionHandler({
			MissingServletRequestParameterException.class,
			MethodArgumentTypeMismatchException.class,
			HttpMessageNotReadableException.class
	})
	public ResponseEntity<ApiError> handleBadRequest(Exception e) {
		ApiError error = new ApiError("INVALID_REQUEST", "Parámetros de la petición no válidos");
		return ResponseEntity.badRequest().body(error);
	}

	@ExceptionHandler(NoResourceFoundException.class)
	public ResponseEntity<ApiError> handleNotFound(NoResourceFoundException e) {
		ApiError error = new ApiError("NOT_FOUND", "Recurso no encontrado");
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
	}

	@ExceptionHandler(ResourceNotFoundException.class)
	public ResponseEntity<ApiError> handleResourceNotFound(ResourceNotFoundException e) {
		ApiError error = new ApiError("NOT_FOUND", e.getMessage());
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
	}

	@ExceptionHandler(GeocodeClientException.class)
	public ResponseEntity<ApiError> handleGeocodeUnavailable(GeocodeClientException e) {
		log.warn("Geocodificador no disponible: {}", e.getMessage());
		ApiError error = new ApiError("GEOCODE_UNAVAILABLE",
				"El servicio de geocodificación no está disponible ahora mismo");
		return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(error);
	}

	@ExceptionHandler(GeocodeRateLimitException.class)
	public ResponseEntity<ApiError> handleGeocodeRateLimit(GeocodeRateLimitException e) {
		ApiError error = new ApiError("RATE_LIMITED", e.getMessage());
		return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(error);
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiError> handleUnexpected(Exception e) {
		log.error("Error no controlado", e);
		ApiError error = new ApiError("INTERNAL_ERROR", "Error interno del servidor");
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
	}
}
