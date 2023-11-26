import React from 'react';
import { Container, Form, Button } from 'react-bootstrap';

const Contact = () => {
  return (
    <Container id='contact' className="my-5">
      <h3>contact me</h3>
      <Form>
        <Form.Group controlId="formBasicEmail">
          <Form.Label>email address</Form.Label>
          <Form.Control type="email" placeholder="enter email" />
        </Form.Group>

        <Form.Group controlId="formBasicMessage">
          <Form.Label>message</Form.Label>
          <Form.Control as="textarea" rows={3} />
        </Form.Group>

        <Button variant="primary" type="submit">
          Submit
        </Button>
      </Form>
    </Container>
  );
};

export default Contact;
