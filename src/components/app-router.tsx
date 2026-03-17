import { Route, Router, Switch } from "wouter";
import Home from "../pages/home";

export default function AppRouter() {
  return (
    <Router>
      <Switch>
        <Route component={Home}></Route>
      </Switch>
    </Router>
  );
}
